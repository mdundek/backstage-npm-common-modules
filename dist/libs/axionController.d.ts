import { ControllerBase } from './controllerBase';
import { KubernetesClient } from './kubernetes';
import { ArgoClient } from './argo';
declare class AxionController extends ControllerBase {
    k8sClient: KubernetesClient;
    argoClient: ArgoClient;
    /**
     *
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost: string, k8sSaToken: string);
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
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     */
    deploy(ctx: any, workflowFilePath: string, workflowName: string, debug?: boolean): Promise<void>;
    /**
     *
     */
    createAxionSystemNamespace(): Promise<void>;
    /**
     * validateCredentials
     * @param ctx
     * @param nakedRepo
     * @param k8sSaToken
     * @param k8sHost
     */
    validateCredentials(ctx: any, nakedRepo: string, k8sSaToken: string, k8sHost: string): Promise<void>;
    /**
     *
     * @param ctx
     * @param clusterEntity
     * @param dnsEntity
     * @param k8sHost
     * @param workflowFilePath
     */
    prepareWorkflow(ctx: any, clusterEntity: any, dnsEntity: any, k8sHost: string): Promise<{
        uidGen: string;
        workflowFilePath: string;
        workflowName: string;
    }>;
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param dnsEntity
     * @param nakedRepo
     * @param k8sSaToken
     * @param k8sHost
     * @param uidGen
     * @returns
     */
    prepareArgoWorkflowDependencies(ctx: any, dnsEntity: any, nakedRepo: string, k8sSaToken: string, k8sHost: string, uidGen: string): Promise<{
        tmpCredsSecretName: string;
    }>;
    /**
     *
     * @param ctx
     * @param k8sBackstageClient
     */
    deployAxionWorkflowTemplates(ctx: any, k8sBackstageClient: KubernetesClient): Promise<void>;
}
export { AxionController };
//# sourceMappingURL=axionController.d.ts.map