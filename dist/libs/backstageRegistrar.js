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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackstageComponentRegistrar = void 0;
const yaml = __importStar(require("js-yaml"));
const kubernetes_1 = require("./kubernetes");
/**
 *
 */
class BackstageComponentRegistrar {
    /**
     *
     * @param kubectlInstance
     * @param inputs
     */
    constructor(gitlabInputs) {
        this.branchName = "main";
        this.commitMessage = "Automated backstage catalog update";
        const gitlabInputParameters = {
            catalogDir: "systems", // ok
            gitlabCredsSecretName: "backstage-secrets", // ok
            gitlabCredsSecretNamespace: "backstage-system", // ok
            gitlabCredsSecretProjectIdField: "GITLAB_BACKSTAGE_CATALOG_REPO_ID"
        };
        this.componentInputs = {};
        this.globalInputs = {};
        this.gitlabInputs = gitlabInputs ? gitlabInputs : gitlabInputParameters;
        this.gitlabToken = "";
        this.gitlabProjectId = "";
        this.genName = "";
        this.k8sClient = new kubernetes_1.KubernetesClient();
    }
    /**
     *
     * @returns
     */
    getGitlabToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.k8sClient.fetchSecret(this.gitlabInputs.gitlabCredsSecretName, this.gitlabInputs.gitlabCredsSecretNamespace);
            if (response.status === 200) {
                const secretData = yield response.json();
                return Buffer.from(secretData.data.GITLAB_GROUP_BACKSTAGE_RW_TOKEN, 'base64').toString('utf-8');
            }
            else {
                throw new Error("Could not retrieve backstage secret");
            }
        });
    }
    /**
     *
     * @returns
     */
    getGitlabProjectId() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.k8sClient.fetchSecret(this.gitlabInputs.gitlabCredsSecretName, this.gitlabInputs.gitlabCredsSecretNamespace);
            if (response.status === 200) {
                const secretData = yield response.json();
                return Buffer.from(secretData.data[this.gitlabInputs.gitlabCredsSecretProjectIdField], 'base64').toString('utf-8');
            }
            else {
                throw new Error("Could not retrieve backstage secret");
            }
        });
    }
    /**
     *
     * @returns
     */
    generateComponentYaml() {
        const { metadataTitle, metadataDescription, resourceOwnerRef, specOther, annotationNeotekType } = this.globalInputs;
        const { specType, specSystem, subcomponentOf, dependsOn1, dependsOn2, dependsOn3, partOf1, partOf2, partOf3 } = this.componentInputs;
        let yaml = `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${this.genName}
  namespace: default
  title: ${metadataTitle}
  description: "${metadataDescription ? metadataDescription : ''}"
  annotations:
    neotek.ea.com/component-type: ${annotationNeotekType}
spec:
  type: ${specType}
  owner: ${resourceOwnerRef}
  lifecycle: production`;
        if (specSystem)
            yaml += `\n  system: ${specSystem}`;
        if (specOther)
            yaml += `\n${specOther.split('\n').map(line => `  ${line}`).join('\n')}`;
        if (subcomponentOf)
            yaml += `\n  subcomponentOf: ${subcomponentOf}`;
        if (dependsOn1 || dependsOn2 || dependsOn3) {
            yaml += `\n  dependsOn:`;
            if (dependsOn1)
                yaml += `\n    - ${dependsOn1}`;
            if (dependsOn2)
                yaml += `\n    - ${dependsOn2}`;
            if (dependsOn3)
                yaml += `\n    - ${dependsOn3}`;
        }
        if (partOf1 || partOf2 || partOf3) {
            yaml += `\n  partOf:`;
            if (partOf1)
                yaml += `\n    - ${partOf1}`;
            if (partOf2)
                yaml += `\n    - ${partOf2}`;
            if (partOf3)
                yaml += `\n    - ${partOf3}`;
        }
        return yaml;
    }
    /**
     *
     * @returns
     */
    generateSystemYaml() {
        const { metadataTitle, metadataDescription, resourceOwnerRef, specOther, annotationNeotekType } = this.globalInputs;
        let yaml = `apiVersion: backstage.io/v1alpha1
kind: System
metadata:
  name: ${this.genName}
  namespace: default
  title: ${metadataTitle}
  description: "${metadataDescription ? metadataDescription : ''}"
  annotations:
    neotek.ea.com/component-type: ${annotationNeotekType}
spec:
  owner: ${resourceOwnerRef}`;
        if (specOther)
            yaml += `\n${specOther.split('\n').map(line => `  ${line}`).join('\n')}`;
        return yaml;
    }
    /**
     *
     * @param filePath
     * @param branchName
     * @returns
     */
    fileExists(filePath, branchName) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(`https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}?ref=${branchName}`, {
                headers: {
                    'PRIVATE-TOKEN': this.gitlabToken
                }
            });
            return response.ok;
        });
    }
    /**
     *
     * @param filePath
     * @param content
     */
    updateOrCreateFile(filePath, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}`;
            const payload = {
                branch: this.branchName,
                content,
                commit_message: this.commitMessage
            };
            const method = (yield this.fileExists(filePath, this.branchName)) ? 'PUT' : 'POST';
            const response = yield fetch(url, {
                method,
                headers: {
                    'PRIVATE-TOKEN': this.gitlabToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Failed to ${method === 'PUT' ? 'update' : 'create'} the file`);
            }
        });
    }
    /**
    *
    * @param filePath
    */
    deleteFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.fileExists(filePath, this.branchName))) {
                return;
            }
            const url = `https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}`;
            const payload = {
                branch: this.branchName,
                commit_message: this.commitMessage
            };
            const response = yield fetch(url, {
                method: "DELETE",
                headers: {
                    'PRIVATE-TOKEN': this.gitlabToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`Failed todelete the file`);
            }
        });
    }
    /**
     *
     * @param filePath
     * @returns
     */
    getFileContent(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(`https://gitlab.ea.com/api/v4/projects/${this.gitlabProjectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${this.branchName}`, {
                headers: {
                    'PRIVATE-TOKEN': this.gitlabToken
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch the file content');
            }
            return response.text();
        });
    }
    /**
     *
     * @param locationsContent
     * @param newLocation
     * @returns
     */
    updateLocationsFileContent(locationsContent, newLocation) {
        const locationsYaml = yaml.load(locationsContent);
        if (!locationsYaml.spec.targets.includes(newLocation)) {
            locationsYaml.spec.targets.push(newLocation);
        }
        return yaml.dump(locationsYaml);
    }
    /**
     *
     * @param locationsContent
     * @param toDelLocation
     * @returns
     */
    removeLocationsFileContent(locationsContent, toDelLocation) {
        const locationsYaml = yaml.load(locationsContent);
        locationsYaml.spec.targets = locationsYaml.spec.targets.filter((location) => location !== toDelLocation);
        return yaml.dump(locationsYaml);
    }
    /**
     *
     * @param newLocation
     */
    updateLocationsFile(newLocation) {
        return __awaiter(this, void 0, void 0, function* () {
            const locationsFilePath = 'locations.yaml';
            let locationsContent = yield this.getFileContent(locationsFilePath);
            locationsContent = this.updateLocationsFileContent(locationsContent, newLocation);
            yield this.updateOrCreateFile(locationsFilePath, locationsContent);
        });
    }
    /**
     *
     * @param toDelLocation
     */
    removeLocationFile(toDelLocation) {
        return __awaiter(this, void 0, void 0, function* () {
            const locationsFilePath = 'locations.yaml';
            let locationsContent = yield this.getFileContent(locationsFilePath);
            locationsContent = this.removeLocationsFileContent(locationsContent, toDelLocation);
            yield this.updateOrCreateFile(locationsFilePath, locationsContent);
        });
    }
    /**
     *
     * @param globalInputs
     * @param componentInputs
     * @returns
     */
    registerComponentInCatalog(globalInputs, componentInputs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.componentInputs = componentInputs;
            this.globalInputs = globalInputs;
            this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
            this.gitlabToken = "";
            this.gitlabProjectId = "";
            this.gitlabToken = yield this.getGitlabToken();
            this.gitlabProjectId = yield this.getGitlabProjectId();
            const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;
            const yamlContent = this.generateComponentYaml();
            yield this.updateOrCreateFile(catalogFilePath, yamlContent);
            yield this.updateLocationsFile(`./${catalogFilePath}`);
            return this.genName;
        });
    }
    /**
     *
     * @param systemRef
     * @param recordType
     * @param name
     * @returns
     */
    static computeCatalogInfoPath(systemRef, recordType, name) {
        return `${this.normalizeSystemRef(systemRef)}/${recordType}/${this.normalizeSystemRef(name)}.yaml`;
    }
    /**
     * normalizeSystemRef
     * @param input
     * @param minimal
     * @returns
     */
    static normalizeSystemRef(input, minimal = false) {
        let withoutPrefix = input.replace(/^component:/, '');
        withoutPrefix = withoutPrefix.replace(/^system:/, '');
        if (minimal) {
            withoutPrefix = withoutPrefix.replace(/^default\//, '').toLowerCase();
        }
        else {
            withoutPrefix = withoutPrefix.replace(/\//g, '-');
            withoutPrefix = withoutPrefix.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        }
        withoutPrefix = withoutPrefix.replace(/\//g, '-');
        return withoutPrefix;
    }
    /**
     *
     * @param globalInputs
     * @param componentInputs
     * @returns
     */
    unregisterEntityFromCatalog(globalInputs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.globalInputs = globalInputs;
            this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
            this.gitlabToken = "";
            this.gitlabProjectId = "";
            this.gitlabToken = yield this.getGitlabToken();
            this.gitlabProjectId = yield this.getGitlabProjectId();
            const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;
            yield this.deleteFile(catalogFilePath);
            yield this.removeLocationFile(`./${catalogFilePath}`);
        });
    }
    /**
    *
    */
    registerSystemInCatalog(globalInputs) {
        return __awaiter(this, void 0, void 0, function* () {
            this.globalInputs = globalInputs;
            this.genName = `${this.globalInputs.recordType}-${this.globalInputs.normalizedName}`;
            this.gitlabToken = "";
            this.gitlabProjectId = "";
            this.gitlabToken = yield this.getGitlabToken();
            this.gitlabProjectId = yield this.getGitlabProjectId();
            const catalogFilePath = `${this.gitlabInputs.catalogDir}/${this.globalInputs.normalizedName}.yaml`;
            const yamlContent = this.generateSystemYaml();
            yield this.updateOrCreateFile(catalogFilePath, yamlContent);
            yield this.updateLocationsFile(`./${catalogFilePath}`);
            return this.genName;
        });
    }
}
exports.BackstageComponentRegistrar = BackstageComponentRegistrar;
