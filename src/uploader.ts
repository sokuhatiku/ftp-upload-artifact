import FTPClient from 'ftp'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'

class FTPArtifactClient {
  private host: string
  private port: number
  private username: string
  private password: string

  constructor(host: string, port: number, username: string, password: string) {
    this.host = host
    this.port = port
    this.username = username
    this.password = password
  }

  async uploadArtifact(
    artifactName: string,
    filesToUpload: string[],
    rootDirectory: string,
    options: UploadOptions
  ): Promise<UploadResponse> {
    const ftpClient = new FTPClient()

    try {
      await new Promise<void>((resolve, reject) => {
        ftpClient.once('ready', resolve)
        ftpClient.once('error', reject)
        ftpClient.connect({
          host: this.host,
          port: this.port,
          user: this.username,
          password: this.password
        })
      })

      let failedItems: string[] = []
      const basePathInServer = path.join(
        '/',
        process.env['GITHUB_RUN_ID'] ?? '0',
        artifactName
      )

      for (const absolutePathInClient of filesToUpload) {
        try {
          const pathInServer = path
            .join(
              basePathInServer,
              path.relative(rootDirectory, absolutePathInClient)
            )
            .replace(/\\/g, '/')

          console.log(`Make directory for ${path.dirname(pathInServer)}...`)
          await new Promise<void>((resolve, reject) => {
            const directory = path.dirname(pathInServer).replace(/\\/g, '/')
            ftpClient.mkdir(directory, true, err => {
              if (err) {
                reject(err)
              } else {
                resolve()
              }
            })
          })

          const stream = fs.createReadStream(absolutePathInClient)
          try {
            console.log(
              `Uploading ${absolutePathInClient} to ${pathInServer}...`
            )
            await new Promise<void>((resolve, reject) => {
              ftpClient.put(stream, pathInServer, err => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
            })
          } finally {
            stream.destroy()
          }
        } catch (err: any) {
          failedItems.push(absolutePathInClient)
          if (options.continueOnError) {
            core.warning(err)
          } else {
            throw err
          }
        }
      }

      return {
        failedItems: [],
        artifactName: artifactName
      } as UploadResponse
    } finally {
      ftpClient.end()
    }
  }
}

export function create(
  host: string,
  port: number,
  username: string,
  password: string
): FTPArtifactClient {
  return new FTPArtifactClient(host, port, username, password)
}

export interface UploadOptions {
  continueOnError?: boolean
  retentionDays?: number
}

export interface UploadResponse {
  failedItems: string[]
  artifactName: string
}
