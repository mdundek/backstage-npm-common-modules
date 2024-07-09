import { ControllerBase } from './controllerBase';
declare class DNSController extends ControllerBase {
    private k8sClient;
    private argoClient;
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost: string, k8sSaToken: string);
    /**
     * computeArgumentsFile
     * @param userAccountProviderSecretNamespace
     * @param userAccountProviderSecretName
     * @param gcpProjectId
     * @param ctx
     * @returns
     */
    computeArgumentsFile(userAccountProviderSecretNamespace: string, userAccountProviderSecretName: string, gcpProjectId: string, ctx: any): any;
    /**
     * validateCredentials
     * @param ctx
     */
    validateCredentials(ctx: any): Promise<void>;
    /**
     * prepareWorkflow
     * @param ctx
     * @returns
     */
    prepareWorkflow(ctx: any, providerSecretName: string): Promise<{
        uidGen: string;
        workflowFilePath: string;
        workflowName: string;
    }>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param nakedRepo
     */
    prepareArgoWorkflowDependencies(ctx: any, nakedRepo: string): Promise<{
        tmpCredsSecretName: string;
        tmpCredsSecretNamespace: string;
    }>;
    /**
     * deploy
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     * @param debug
     */
    deploy(ctx: any, workflowFilePath: string, workflowName: string, debug?: boolean): Promise<void>;
}
export { DNSController };
//# sourceMappingURL=dnsController.d.ts.map