declare class AmpController {
    private k8sClient;
    private argoClient;
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost?: string, k8sSaToken?: string);
    /**
     * prepareTemporarySecret
     * @param cloudCredentials
     * @param cloudProvider
     * @param gitlabAuthToken
     */
    prepareTemporarySecret(cloudCredentials: string, gitlabGroupAuthToken: string, cloudProvider: string, gcpRegion: string): Promise<void>;
    /**
     *
     * @param clusterEntity
     * @param dnsEntity
     * @param gcpProjectId
     * @param ctx
     * @returns
     */
    /**
     *
     * @param workflow
     * @param replacements
     * @returns
     */
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
     */
    createAmpSystemNamespace(): Promise<void>;
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
    /**
     *
     * @param ctx
     * @param clusterEntity
     * @param dnsEntity
     * @param k8sHost
     * @param workflowFilePath
     */
    prepareWorkflow(ctx: any, clusterEntity: any, dnsEntity: any, k8sHost: string): Promise<void>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx: any, cloudProvider: string, gcpRegion: string): Promise<void>;
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    private createWorkflowScriptsConfigMap;
}
export { AmpController };
//# sourceMappingURL=ampController.d.ts.map