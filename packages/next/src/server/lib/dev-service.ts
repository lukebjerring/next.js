import type { IncomingMessage } from 'http'
import type { DevInstance } from './router-utils/setup-dev'
import type { WorkerRequestHandler } from './types'

import { createRequestResponseMocks } from './mock-request'

/**
 * The DevService provides an interface to perform tasks with the builder
 * while in development.
 */
export class DevService {
  constructor(
    private readonly instance: DevInstance,
    private readonly handler: WorkerRequestHandler
  ) {}

  public ensurePage: typeof this.instance.hotReloader.ensurePage = async (
    definition
  ) => {
    // TODO: remove after ensure is pulled out of server
    return await this.instance.hotReloader.ensurePage(definition)
  }

  public logErrorWithOriginalStack: typeof this.instance.logErrorWithOriginalStack =
    async (...args) => {
      return await this.instance.logErrorWithOriginalStack(...args)
    }

  public async getFallbackErrorComponents() {
    await this.instance.hotReloader.buildFallbackError()
    // Build the error page to ensure the fallback is built too.
    // TODO: See if this can be moved into hotReloader or removed.
    await this.instance.hotReloader.ensurePage({
      page: '/_error',
      clientOnly: false,
      definition: undefined,
    })
  }

  public async getCompilationError(page: string) {
    const errors = await this.instance.hotReloader.getCompilationErrors(page)
    if (!errors) return

    // Return the very first error we found.
    return errors[0]
  }

  public async revalidate({
    urlPath,
    revalidateHeaders,
    opts: revalidateOpts,
  }: {
    urlPath: string
    revalidateHeaders: IncomingMessage['headers']
    opts: any
  }) {
    const mocked = createRequestResponseMocks({
      url: urlPath,
      headers: revalidateHeaders,
    })

    await this.handler(mocked.req, mocked.res)
    await mocked.res.hasStreamed

    if (
      mocked.res.getHeader('x-nextjs-cache') !== 'REVALIDATED' &&
      !(mocked.res.statusCode === 404 && revalidateOpts.unstable_onlyGenerated)
    ) {
      throw new Error(`Invalid response ${mocked.res.statusCode}`)
    }

    return {}
  }
}
