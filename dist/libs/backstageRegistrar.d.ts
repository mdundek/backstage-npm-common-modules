export interface GitlabInputsParameters {
    catalogDir: string;
    gitlabCredsSecretName: string;
    gitlabCredsSecretNamespace: string;
    gitlabCredsSecretProjectIdField: string;
}
export interface GlobalInputsParameters {
    recordType: string;
    resourceOwnerRef?: string;
    annotationNeotekType?: string;
    normalizedName: string;
    metadataTitle?: string;
    metadataDescription?: string;
    specOther?: string;
}
export interface ComponentInputsParameters {
    specType: string;
    specSystem?: string;
    subcomponentOf?: string;
    dependsOn1?: string;
    dependsOn2?: string;
    dependsOn3?: string;
    partOf1?: string;
    partOf2?: string;
    partOf3?: string;
}
/**
 *
 */
export declare class BackstageComponentRegistrar {
    private componentInputs;
    private globalInputs;
    private gitlabInputs;
    private gitlabToken;
    private gitlabProjectId;
    private genName;
    private branchName;
    private commitMessage;
    private k8sCLient;
    /**
     *
     * @param kubectlInstance
     * @param inputs
     */
    constructor(gitlabInputs?: GitlabInputsParameters);
    /**
     *
     * @returns
     */
    private getGitlabToken;
    /**
     *
     * @returns
     */
    private getGitlabProjectId;
    /**
     *
     * @returns
     */
    private generateComponentYaml;
    /**
     *
     * @returns
     */
    private generateSystemYaml;
    /**
     *
     * @param filePath
     * @param branchName
     * @returns
     */
    private fileExists;
    /**
     *
     * @param filePath
     * @param content
     */
    private updateOrCreateFile;
    /**
    *
    * @param filePath
    */
    private deleteFile;
    /**
     *
     * @param filePath
     * @returns
     */
    private getFileContent;
    /**
     *
     * @param locationsContent
     * @param newLocation
     * @returns
     */
    private updateLocationsFileContent;
    /**
     *
     * @param locationsContent
     * @param toDelLocation
     * @returns
     */
    private removeLocationsFileContent;
    /**
     *
     * @param newLocation
     */
    private updateLocationsFile;
    /**
     *
     * @param toDelLocation
     */
    private removeLocationFile;
    /**
     *
     * @param globalInputs
     * @param componentInputs
     * @returns
     */
    registerComponentInCatalog(globalInputs: GlobalInputsParameters, componentInputs: ComponentInputsParameters): Promise<string>;
    /**
     *
     * @param globalInputs
     * @param componentInputs
     * @returns
     */
    unregisterEntityFromCatalog(globalInputs: GlobalInputsParameters): Promise<void>;
    /**
    *
    */
    registerSystemInCatalog(globalInputs: GlobalInputsParameters): Promise<string>;
}
//# sourceMappingURL=backstageRegistrar.d.ts.map