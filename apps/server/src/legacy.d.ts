declare module '*repository-marker.mjs' {
 export function ensureRepositoryMarker(path: string, options?: {execute?: (program:string,args:string[],options:object)=>Promise<unknown>}): Promise<{repositoryIdentity: string}>;
}
