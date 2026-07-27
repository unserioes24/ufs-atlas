import type { ComponentType } from 'react'

/**
 * The legacy app is still plain JavaScript. Until its views have moved into
 * typed components, this is all the compiler needs to know about it.
 */
declare const App: ComponentType
export default App
