import FTPClient from 'ftp'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'

class FTPArtifactClient {
  private ftpClient: FTPClient
  private connecting: Promise<void>

  constructor(host: string, port: number, username: string, password: string) {
    this.ftpClient = new FTPClient()
    this.ftpClient.connect({
      host: host,
      port: port,
      user: username,
      password: password
    })
    this.connecting = new Promise<void>((resolve, reject) => {
      this.ftpClient.once('ready', resolve)
      this.ftpClient.once('error', reject)
    })
  }

  async uploadArtifact(
    artifactName: string,
    filesToUpload: string[],
    rootDirectory: string,
    options: UploadOptions
  ): Promise<UploadResponse> {
    await this.connecting

    let failedItems: string[] = []
    const basePathInServer = path.join(
      '/',
      process.env['GITHUB_RUN_ID'] ?? '0',
      artifactName
    )

    for (const absolutePathInClient of filesToUpload) {
      try {
        const pathInServer = path.join(
          basePathInServer,
          path.relative(rootDirectory, absolutePathInClient)
        )

        console.log(`Make directory for ${path.dirname(pathInServer)}...`)
        await new Promise<void>((resolve, reject) => {
          this.ftpClient.mkdir(path.dirname(pathInServer), true, err => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })

        const stream = fs.createReadStream(absolutePathInClient)
        try {
          console.log(`Uploading ${absolutePathInClient} to ${pathInServer}...`)
          await new Promise<void>((resolve, reject) => {
            this.ftpClient.put(stream, pathInServer, err => {
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
