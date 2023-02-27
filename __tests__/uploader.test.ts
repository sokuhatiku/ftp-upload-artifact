import fs from 'fs'
import {create, UploadOptions} from '../src/uploader'
import FTPClient from 'ftp'
import net from 'net'
import FtpSrv from 'ftp-srv'
import path from 'path'

const waitForPortToOpen = (host: string, port: number, timeout: number) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${host}:${port} to open`))
    }, timeout)

    const socket = new net.Socket()

    const connect = () => {
      socket.connect(port, host)
    }
    socket.on('connect', () => {
      console.log(
        `[waitForPortToOpen]connection established to ${host}:${port}`
      )
      clearTimeout(timer)
      socket.destroy()
      resolve()
    })
    let retryCount = 0
    socket.on('error', async () => {
      // waint and reconnect
      retryCount++
      console.log(
        `[waitForPortToOpen]retrying to connect to ${host}:${port}...(${retryCount})`
      )
      await new Promise(resolve => setTimeout(resolve, 1000))
      connect()
    })
    console.log(`[waitForPortToOpen]trying to connect to ${host}:${port}...`)
    socket.connect(port, host)
  })

describe('Uploader', () => {
  const testRoot = 'test'
  const clientRoot = path.join(testRoot, '/client_root')
  const serverRoot = path.join(testRoot, '/server_root')
  const serverAddr = 'localhost'
  const serverPort = 21
  let server: FtpSrv

  beforeAll(async () => {
    fs.mkdirSync(clientRoot, {recursive: true})
    fs.mkdirSync(serverRoot, {recursive: true})
    server = new FtpSrv({
      url: `ftp://${serverAddr}:${serverPort}`,
      pasv_url: `ftp://${serverAddr}`,
      pasv_min: 49152,
      pasv_max: 65535,
      anonymous: true
    })

    server.on('login', ({username}, resolve) => {
      console.log('[login]username:', username)
      return resolve({root: serverRoot})
    })

    await server.listen()

    await waitForPortToOpen(serverAddr, serverPort, 10000)
  }, 10000)

  afterEach(() => {
    fs.rmSync(clientRoot + '/*', {force: true, recursive: true})
    fs.rmSync(serverRoot + '/*', {force: true, recursive: true})
  })

  afterAll(async () => {
    await server.close()
    fs.rmSync(testRoot, {force: true, recursive: true})
  })

  test('Pure FTP test', async () => {
    const client = new FTPClient()
    client.connect({
      host: serverAddr,
      port: serverPort
    })

    await new Promise<void>(resolve => {
      client.on('ready', resolve)
      client.connect({
        host: serverAddr,
        port: serverPort,
        user: 'anonymous',
        password: 'anonymous'
      })
    })

    await new Promise<void>((resolve, reject) => {
      client.put(Buffer.from('testdata'), 'test.txt', err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    expect(fs.existsSync(`${serverRoot}/test.txt`)).toBe(true)
    expect(fs.readFileSync(`${serverRoot}/test.txt`, 'utf8')).toBe('testdata')
    client.end()
  }, 10000)

  test('Upload Artifact', async () => {
    const uploader = create(serverAddr, serverPort, 'anonymous', 'anonymous')

    const fileToUpload = `${clientRoot}/path/to/dictionary/test.txt`
    fs.mkdirSync(path.dirname(fileToUpload), {recursive: true})
    fs.writeFileSync(fileToUpload, 'testdata')

    const artifactName = 'TestArtifact'

    const response = await uploader.uploadArtifact(
      artifactName,
      [path.resolve(fileToUpload)],
      path.resolve(clientRoot),
      {} as UploadOptions
    )

    expect(response.artifactName).toBe(artifactName)
    expect(response.failedItems).toEqual([])
    expect(
      fs.existsSync(
        path.join(
          serverRoot,
          process.env['GITHUB_RUN_ID'] ?? '0',
          artifactName,
          'path',
          'to',
          'dictionary',
          'test.txt'
        )
      )
    ).toBe(true)
  })
})
