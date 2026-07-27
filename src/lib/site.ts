/**
 * Details of whoever runs this copy of the site. They differ per deployment,
 * so they come in through the build rather than sitting in the source:
 *
 *   VITE_IMPRINT_URL   address of the imprint
 *   VITE_OPERATOR_MAIL contact address for privacy questions
 *   VITE_SITE_URL      the site's own address, for canonical links
 *
 * Where one is missing the page leaves it out instead of printing a stub - a
 * dead imprint link is worse than none.
 */
const env = import.meta.env

export const IMPRINT_URL: string = env.VITE_IMPRINT_URL ?? ''
export const OPERATOR_MAIL: string = env.VITE_OPERATOR_MAIL ?? ''
export const SITE_URL: string = env.VITE_SITE_URL ?? 'https://ufs-atlas.de'
