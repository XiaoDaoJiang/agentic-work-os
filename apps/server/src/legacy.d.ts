declare module '*repository-marker.mjs' {
 export function ensureRepositoryMarker(path: string, options?: {execute?: (program:string,args:string[],options:object)=>Promise<unknown>}): Promise<{repositoryIdentity: string}>;
}

declare module '*verification-invocation.mjs' { export function validateVerificationInvocation(document: unknown): unknown; }
declare module '*artifact-store.mjs' {
 export function createArtifactStore(root:string):Promise<{root:string;stagingRoot:string;objectsRoot:string}>;
 export function sealArtifact(options:Record<string,unknown>):Promise<{artifactId:string;sha256:string}>;
}
declare module '*change-package-seal.mjs' { export function sealUniqueChangePackage(options:Record<string,unknown>):Promise<{artifactId:string;sha256:string}>; }
declare module '*change-package.mjs' {
 export function buildChangePackage(options:Record<string,unknown>):{bytes:Buffer};
 export function validateChangePackageBytes(bytes:Buffer):{base_revision:string;result_tree_hash:string;git_object_format:string;verification_invocation:unknown;entries:unknown[];evidence:Record<string,{artifact_id:string;sha256:string}>};
}
declare module '*delivery-integrity.mjs' {
 export function computeDeliveryIntegrity(options:{store:{root:string};db:unknown;runId:string;manifestValidator:(bytes:Buffer)=>boolean;replayValidator:(bytes:Buffer)=>boolean}):Promise<import('./contracts.js').ReviewContext['delivery_integrity']>;
}
