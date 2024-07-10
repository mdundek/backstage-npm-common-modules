"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSController = void 0;
const controllerBase_1 = require("./controllerBase");
const kubernetes_1 = require("./kubernetes");
const backstageRegistrar_1 = require("./backstageRegistrar");
const argo_1 = require("./argo");
const short_unique_id_1 = __importDefault(require("short-unique-id"));
const fs = __importStar(require("fs/promises"));
const yaml = __importStar(require("js-yaml"));
const path = __importStar(require("path"));
const KUBE_API_SERVER = process.env.KUBE_API_SERVER || 'https://kubernetes.default.svc';
const SA_TOKEN = process.env.KUBE_API_SA_TOKEN || '';
class DNSController extends controllerBase_1.ControllerBase {
    /**
     * constructor
     * @param k8sHost
     * @param k8sSaToken
     */
    constructor(k8sHost, k8sSaToken) {
        super();
        this.k8sClient = new kubernetes_1.KubernetesClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
        this.argoClient = new argo_1.ArgoClient(k8sHost || KUBE_API_SERVER, k8sSaToken || SA_TOKEN);
    }
    /**
     * computeArgumentsFile
     * @param userAccountProviderSecretNamespace
     * @param userAccountProviderSecretName
     * @param gcpProjectId
     * @param ctx
     * @returns
     */
    computeArgumentsFile(userAccountProviderSecretNamespace, userAccountProviderSecretName, gcpProjectId, ctx) {
        const systemNormalizedName = backstageRegistrar_1.BackstageComponentRegistrar.normalizeSystemRef(ctx.input.targetSystem);
        // Prepare the Argo Workflow arguments for the Axion installation
        const args = {
            "axionOciRepo": "captech-docker-fed.artifactory.ea.com/captech-msi/core/axion/mdundek/dev",
            "workflowUtilsImgVersion": "2.4.36-amd64",
            "resourceOwnerRef": ctx.input.userOwnerRef,
            "targetBackstageSystem": ctx.input.targetSystem,
            "targetBackstageSystemNormalized": systemNormalizedName,
            "userCloudProvider": ctx.input.userCloudProvider,
            "domainOwnerAccountId": ctx.input.domainOwnerAccountId,
            "domainOwnerAccountDisplayName": ctx.input.domainOwnerAccountDisplayName,
            "gitlabCredsSecretName": "backstage-secrets",
            "gitlabCredsSecretNamespace": "backstage-system",
            "domain": ctx.input.domain,
            "domainNameNormalized": ctx.input.domain.replaceAll('.', '-'),
            "subdomain": ctx.input.subdomain,
            "route53RegionUserAccount": ctx.input.userAccountRoute53Region,
            "cloudDNSRegionUserAccount": ctx.input.userAccountCloudDNSRegion,
            "gcpProjectId": gcpProjectId,
            "route53RegionDomainOwnerAccount": ctx.input.domainOwnerAccountRoute53Region,
            "rootDomainZoneIdDomainOwnerAccount": ctx.input.rootDomainZoneId,
            "providerConfigNameUserAccount": `${systemNormalizedName}-dns-provider-config`,
            "providerSecretNameUserAccount": userAccountProviderSecretName,
            "providerSecretNamespaceUserAccount": userAccountProviderSecretNamespace,
            "providerConfigNameDomainOwnerAccount": ctx.input.domainOwnerProviderConfigName,
            "providerSecretNameDomainOwnerAccount": ctx.input.domainOwnerProviderSecretName,
            "providerSecretNamespaceDomainOwnerAccount": ctx.input.domainOwnerProviderSecretNamespace,
        };
        return args;
    }
    /**
     * validateCredentials
     * @param ctx
     */
    validateCredentials(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            ctx.logger.info(' => Validating credentials and basic access...');
            const authErrors = [];
            const cloudCredsValid = yield this.testGcpCloudCreds(ctx.input.cloudCredentials);
            if (!cloudCredsValid) {
                authErrors.push("- Your cloud credentials are invalid");
            }
            if (authErrors.length > 0) {
                throw new Error(`The following errors were found:\n${authErrors.join("\n")}`);
            }
        });
    }
    /**
     * prepareWorkflow
     * @param ctx
     * @param providerSecretName
     * @param providerSecretNamespace
     * @returns
     */
    prepareWorkflow(ctx, providerSecretName, providerSecretNamespace) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate a unique name for the workflow
            let uid = new short_unique_id_1.default({ length: 5 });
            let uidGen = uid.rnd().toLowerCase();
            // Fetch the Axion workflow from the Axion workflow repository
            // NOTE: We do not use the target cluster to initiate this here because
            //       it queires the backstage Kube API to get the gitlab credentials,
            //       those are located on this cluster
            ctx.logger.info(' => Fetching Axion workflow from the Axion workflow repository...');
            const workflow = yield new argo_1.ArgoClient().fetchWorkflowFromWorkflowRepo('dns/create-hosted-zone.yaml');
            // Compute the arguments for the Axion installation
            ctx.logger.info(' => Preparing for DNS Zone setup...');
            // Update the workflow with the computed arguments
            const args = this.computeArgumentsFile(providerSecretNamespace, providerSecretName, JSON.parse(ctx.input.gcp_credentials).project_id, ctx);
            const updatedWorkflow = this.updateWorkflowSpecArguments(workflow, args);
            let workflowName = `${uidGen}-route53-hosted-zone`;
            updatedWorkflow.metadata.name = workflowName;
            // Convert the JSON object to YAML format
            const yamlContent = yaml.dump(updatedWorkflow);
            uid = new short_unique_id_1.default({ length: 10 });
            const workflowFilePath = `./${uid.rnd()}-workflow.yaml`;
            const absolutePath = path.resolve(__dirname, workflowFilePath);
            // Write the YAML content to the specified file
            yield fs.writeFile(absolutePath, yamlContent, 'utf-8');
            return {
                uidGen: uidGen,
                workflowFilePath: absolutePath,
                workflowName: workflowName
            };
        });
    }
    /**
     * prepareArgoWorkflowDependencies
     * @param ctx
     * @param nakedRepo
     * @param providerSecretName
     * @param providerSecretNamespace
     */
    prepareArgoWorkflowDependencies(ctx, nakedRepo, providerSecretName, providerSecretNamespace) {
        return __awaiter(this, void 0, void 0, function* () {
            // Prepare the temporary secret for the DNS workflow setup
            // Create the provider secret for AWS
            if (ctx.input.userCloudProvider == "AWS") {
                yield this.createAwsProviderConfigSecret(this.k8sClient, providerSecretName, providerSecretNamespace, ctx.input.aws_access_key_id, ctx.input.aws_secret_access_key);
            }
            // Create the provider secret for GCP
            else if (ctx.input.userCloudProvider == "GCP") {
                yield this.createGcpProviderConfigSecret(this.k8sClient, providerSecretName, providerSecretNamespace, ctx.input.gcp_credentials);
            }
            // Create the Argo Pull Secret if it does not exist
            yield this.createArgoPullSecret(this.k8sClient, nakedRepo, ctx.input.ociAuthUsername, ctx.input.ociAuthToken);
            // Create the Workflow Service Account if it does not exist
            yield this.createArgoWorkflowAdminSa(this.k8sClient);
            // Make sure we have latest version of templates deployed
            yield this.deployBackstageWorkflowTemplates(ctx, this.k8sClient);
        });
    }
    /**
     * deploy
     * @param ctx
     * @param workflowFilePath
     * @param workflowName
     * @param debug
     */
    deploy(ctx, workflowFilePath, workflowName, debug) {
        return __awaiter(this, void 0, void 0, function* () {
            // Run the workflow
            yield this.argoClient.runWorkflow(ctx.logger, workflowFilePath, workflowName, false, debug);
        });
    }
}
exports.DNSController = DNSController;
