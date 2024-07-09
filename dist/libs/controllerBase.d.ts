declare class ControllerBase {
    constructor();
    /**
     * createAwsProviderConfigSecret
     * @param k8sClient
     * @param secretName
     * @param namespace
     * @param aws_access_key_id
     * @param aws_secret_access_key
     */
    createAwsProviderConfigSecret(k8sClient: any, secretName: string, namespace: string, aws_access_key_id: string, aws_secret_access_key: string): Promise<void>;
    /**
     * createGcpProviderConfigSecret
     * @param k8sClient
     * @param secretName
     * @param namespace
     * @param jsonKey
     */
    createGcpProviderConfigSecret(k8sClient: any, secretName: string, namespace: string, jsonKey: string): Promise<void>;
    /**
     *
     * @param workflow
     * @param replacements
     * @returns
     */
    updateWorkflowSpecArguments(workflow: any, replacements: any): any;
    /**
     * createArgoWorkflowAdminSa
     * @param k8sClient
     */
    createArgoWorkflowAdminSa(k8sClient: any): Promise<void>;
    /**
     * createArgoPullSecret
     * @param k8sClient
     * @param repo
     * @param username
     * @param password
     */
    createArgoPullSecret(k8sClient: any, repo: string, username: string, password: string): Promise<void>;
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
     * testGcpCloudCreds
     * @param jsonKey
     * @returns
     */
    testGcpCloudCreds(jsonKey: string): Promise<boolean>;
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
    /**
     * ensureArgoIsInstalled
     * @param ctx
     * @param k8sClient
     */
    ensureArgoIsInstalled(ctx: any, k8sClient: any): Promise<void>;
    /**
     *
     * @param ctx
     */
    deployBackstageWorkflowTemplates(ctx: any, k8sClient: any): Promise<void>;
}
export { ControllerBase };
//# sourceMappingURL=controllerBase.d.ts.map