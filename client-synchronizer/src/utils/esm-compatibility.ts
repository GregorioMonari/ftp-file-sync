export async function importEsmModule<T>(
    name: string
  ): Promise<T> {
    const module = eval(
      `(async () => {return await import("${ name }")})()`
    )
    return module as T
}

/*
//
// usage
//

import type MyModuleType from 'myesmmodule'

const MyModule = await importEsmModule<typeof MyModuleType>('myesmmodule')
*/