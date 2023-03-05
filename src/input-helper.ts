import * as core from '@actions/core'
import {Inputs, NoFileOptions} from './constants'
import {UploadInputs} from './upload-inputs'

/**
 * Helper to get all the inputs for the action
 */
export function getInputs(): UploadInputs {
  const name = core.getInput(Inputs.Name)
  const path = core.getInput(Inputs.Path, {required: true})

  const ifNoFilesFound = core.getInput(Inputs.IfNoFilesFound)
  const noFileBehavior: NoFileOptions = NoFileOptions[ifNoFilesFound]

  if (!noFileBehavior) {
    core.setFailed(
      `Unrecognized ${
        Inputs.IfNoFilesFound
      } input. Provided: ${ifNoFilesFound}. Available options: ${Object.keys(
        NoFileOptions
      )}`
    )
  }

  const host = core.getInput(Inputs.Host)
  const port = Number(core.getInput(Inputs.Port))
  const username = core.getInput(Inputs.Username)
  const password = core.getInput(Inputs.Password)
  const secure = Boolean(core.getInput(Inputs.Secure))
  const remotePath = core.getInput(Inputs.RemotePath)

  const inputs = {
    artifactName: name,
    searchPath: path,
    ifNoFilesFound: noFileBehavior,
    host: host,
    port: port,
    username: username,
    password: password,
    secure: secure,
    remotePath: remotePath
  } as UploadInputs

  const retentionDaysStr = core.getInput(Inputs.RetentionDays)
  if (retentionDaysStr) {
    inputs.retentionDays = parseInt(retentionDaysStr)
    if (isNaN(inputs.retentionDays)) {
      core.setFailed('Invalid retention-days')
    }
  }

  return inputs
}
