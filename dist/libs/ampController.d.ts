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
     public computeArgumentsFile
     * @param ampGitlabGroupId
     * @param projectTitleName
     * @param projectDnsName
     * @param teamMailingListEmail
     * @param devDnsRootDomain
     * @param intDnsRootDomain
     * @param ampDataGitRepoUrl
     * @param ampCodeGitRepoUrl
     * @param targetDevCertManagerIssuerName
     * @param targetDevCertManagerRootCertName
     * @param targetIntCertManagerIssuerName
     * @param targetIntCertManagerRootCertName
     * @param oauthClientId
     * @param terraformCleanupBeforeCreate
     * @returns
     */
    computeArgumentsFile(ampGitlabGroupId: string, projectTitleName: string, projectDnsName: string, teamMailingListEmail: string, devDnsRootDomain: string, intDnsRootDomain: string, ampDataGitRepoUrl: string, ampCodeGitRepoUrl: string, targetDevCertManagerIssuerName: string, targetDevCertManagerRootCertName: string, targetIntCertManagerIssuerName: string, targetIntCertManagerRootCertName: string, oauthClientId: string, terraformCleanupBeforeCreate: boolean, tempSecretName: string): any;
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
    deploy(ctx: any, workflowFilePath: string, workflowName: string, debug?: boolean): Promise<void>;
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
     * prepareWorkflow
     * @param ctx
     * @param devDnsRootDomain
     * @param intDnsRootDomain
     * @param targetDevCertManagerIssuerName
     * @param targetDevCertManagerRootCertName
     * @param targetIntCertManagerIssuerName
     * @param targetIntCertManagerRootCertName
     * @param ampDataGitRepoUrl
     * @param ampCodeGitRepoUrl
     * @returns
     */
    prepareWorkflow(ctx: any, masterConfigJson: any, devDnsRootDomain: string, intDnsRootDomain: string, targetDevCertManagerIssuerName: string, targetDevCertManagerRootCertName: string, targetIntCertManagerIssuerName: string, targetIntCertManagerRootCertName: string, ampDataGitRepoUrl: string, ampCodeGitRepoUrl: string): Promise<{
        uidGen: string;
        workflowFilePath: string;
        workflowName: string;
    }>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx: any, cloudProvider: string, gcpRegion: string, uidGen: string): Promise<{
        tmpCredsSecretName: string;
    }>;
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    private createWorkflowScriptsConfigMap;
    /**
     *
     * @param ctx
     */
    ensureArgoIsInstalled(ctx: any): Promise<void>;
    /**
     *
     * @param ctx
     */
    deployBackstageCommonWorkflowTemplate(ctx: any): Promise<void>;
}
export { AmpController };
//# sourceMappingURL=ampController.d.ts.map