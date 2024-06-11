declare class AxionController {
    private k8sClient;
    private argoClient;
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost: string, k8sSaToken: string);
    /**
     *
     * @param cloudCredentials
     * @param cloudProvider
     * @param ociAuthToken
     * @param vaultTemporaryToken
     */
    prepareTemporarySecret(cloudCredentials: string, cloudProvider: string, ociAuthUsername: string, ociAuthToken: string, vaultTemporaryToken?: string): Promise<void>;
    /**
     *
     * @param clusterEntity
     * @param dnsEntity
     * @param gcpProjectId
     * @param ctx
     * @returns
     */
    computeArgumentsFile(clusterEntity: any, dnsEntity: any, gcpProjectId: string, ctx: any): any;
    /**
     *
     * @param workflow
     * @param replacements
     * @returns
     */
    updateWorkflowSpecArguments(workflow: any, replacements: any): any;
    /**
     *
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     */
    deploy(ctx: any, workflowFilePath: string, workflowName: string): Promise<void>;
    /**
     *
     */
    createArgoWorkflowAdminSa(): Promise<void>;
    /**
     *
     * @param repo
     * @param username
     * @param password
     */
    createArgoPullSecret(repo: string, username: string, password: string): Promise<void>;
    /**
     *
     */
    createAxionSystemNamespace(): Promise<void>;
    /**
     *
     * @param vaultToken
     * @param vaultEnvironment
     * @param vaultNamespace
     * @returns
     */
    testVaultCreds(vaultToken: string, vaultEnvironment: string, vaultNamespace: string): Promise<boolean>;
    /**
     *
     * @param repo
     * @param username
     * @param password
     * @returns
     */
    testOciCreds(repo: string, username: string, password: string): Promise<boolean>;
    /**
     *
     * @param jsonKey
     * @returns
     */
    testCloudCreds(jsonKey: string, projectId: string): Promise<boolean>;
    /**
     *
     * @param token
     * @param kubeApi
     * @returns
     */
    testKubeToken(token: string, kubeApi: string): Promise<boolean>;
    /**
     *
     * @param command
     * @param args
     * @returns
     */
    private runCommand;
}
export { AxionController };
//# sourceMappingURL=axionController.d.ts.map