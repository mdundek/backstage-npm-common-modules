import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { ArgoClient } from './argo';
declare class DNSController extends ControllerBase {
    k8sClient: KubernetesClient;
    argoClient: ArgoClient;
    /**
     * constructor
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost?: string, k8sSaToken?: string);
    /**
     * computeArgumentsFile
     * @param userAccountProviderSecretNamespace
     * @param userAccountProviderSecretName
     * @param gcpProjectId
     * @param secretNameDomainOwnerAccount
     * @param secretNamespaceDomainOwnerAccount
     * @param ctx
     * @returns
     */
    computeArgumentsFile(userAccountProviderSecretNamespace: string, userAccountProviderSecretName: string, gcpProjectId: string, secretNameDomainOwnerAccount: string, secretNamespaceDomainOwnerAccount: string, ctx: any): any;
    /**
     * validateCredentials
     * @param ctx
     */
    validateCredentials(ctx: any): Promise<void>;
    /**
     * prepareWorkflow
     * @param ctx
     * @param providerSecretName
     * @param providerSecretNamespace
     * @param domainOwnerSecretName
     * @param domainOwnerSecretNamespace
     * @returns
     */
    prepareWorkflow(ctx: any, providerSecretName: string, providerSecretNamespace: string, domainOwnerSecretName: string, domainOwnerSecretNamespace: string): Promise<{
        uidGen: string;
        workflowFilePath: string;
        workflowName: string;
    }>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param nakedRepo
     * @param providerSecretName
     * @param providerSecretNamespace
     */
    prepareArgoWorkflowDependencies(ctx: any, nakedRepo: string, providerSecretName: string, providerSecretNamespace: string): Promise<void>;
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