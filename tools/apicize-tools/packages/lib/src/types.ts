// Type definitions for .apicize file format
// These interfaces match the documented .apicize JSON structure

// ============= Enums =============

export enum BodyType {
  None = 'None',
  Text = 'Text',
  JSON = 'JSON',
  XML = 'XML',
  Form = 'Form',
  Raw = 'Raw',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum ExecutionMode {
  SEQUENTIAL = 'SEQUENTIAL',
  CONCURRENT = 'CONCURRENT',
}

export enum AuthorizationType {
  Basic = 'Basic',
  OAuth2Client = 'OAuth2Client',
  OAuth2Pkce = 'OAuth2Pkce',
  ApiKey = 'ApiKey',
}

export enum VariableType {
  TEXT = 'TEXT',
  JSON = 'JSON',
  FILE_JSON = 'FILE-JSON',
  FILE_CSV = 'FILE-CSV',
}

export enum DataType {
  JSON = 'JSON',
  FILE_JSON = 'FILE-JSON',
  FILE_CSV = 'FILE-CSV',
}

export type RequestMode = 'cors' | 'no-cors' | 'same-origin';

// ============= Common Interfaces =============

export interface NameValuePair {
  name: string;
  value: string;
  disabled?: boolean;
}

export interface SelectedItem {
  id: string;
  name: string;
}

// ============= Body Interfaces =============

export interface RequestBodyBase {
  type: BodyType;
}

export interface RequestBodyNone extends RequestBodyBase {
  type: BodyType.None;
  data?: undefined;
  formatted?: undefined;
}

export interface RequestBodyText extends RequestBodyBase {
  type: BodyType.Text;
  data: string;
  formatted?: string;
}

export interface RequestBodyJSON extends RequestBodyBase {
  type: BodyType.JSON;
  data: Record<string, unknown>;
  formatted?: string;
}

export interface RequestBodyXML extends RequestBodyBase {
  type: BodyType.XML;
  data: string;
  formatted?: string;
}

export interface RequestBodyForm extends RequestBodyBase {
  type: BodyType.Form;
  data: NameValuePair[];
  formatted?: string;
}

export interface RequestBodyRaw extends RequestBodyBase {
  type: BodyType.Raw;
  data: Uint8Array;
  formatted?: string;
}

export type RequestBody =
  | RequestBodyNone
  | RequestBodyText
  | RequestBodyJSON
  | RequestBodyXML
  | RequestBodyForm
  | RequestBodyRaw;

// ============= Request Interfaces =============

export interface Request {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  test?: string;
  headers?: NameValuePair[];
  body?: RequestBody;
  queryStringParams?: NameValuePair[];
  timeout?: number;
  numberOfRedirects?: number;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  keepAlive?: boolean;
  acceptInvalidCerts?: boolean;
  mode?: RequestMode;
  referrer?: string;
  referrerPolicy?: string;
  duplex?: string;
}

export interface RequestGroup {
  id: string;
  name: string;
  children: Array<Request | RequestGroup>;
  execution?: ExecutionMode;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  selectedScenario?: SelectedItem;
  selectedData?: SelectedItem;
}

// ============= Variable and Scenario Interfaces =============

export interface Variable {
  name: string;
  value: string;
  type: VariableType;
  disabled?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  variables: Variable[];
}

// ============= Data Interfaces =============

export interface ExternalData {
  id: string;
  name: string;
  type: DataType;
  source: string;
  validation_errors?: string | null;
}

// ============= Authorization Interfaces =============

export interface AuthorizationBase {
  id: string;
  name: string;
  type: AuthorizationType;
}

export interface BasicAuthorization extends AuthorizationBase {
  type: AuthorizationType.Basic;
  username: string;
  password: string;
}

export interface OAuth2ClientAuthorization extends AuthorizationBase {
  type: AuthorizationType.OAuth2Client;
  accessTokenUrl: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scope?: string;
}

export interface OAuth2PkceAuthorization extends AuthorizationBase {
  type: AuthorizationType.OAuth2Pkce;
  authorizeUrl: string;
  accessTokenUrl: string;
  clientId: string;
  scope?: string;
  audience?: string;
}

export interface ApiKeyAuthorization extends AuthorizationBase {
  type: AuthorizationType.ApiKey;
  header: string;
  value: string;
}

export type Authorization =
  | BasicAuthorization
  | OAuth2ClientAuthorization
  | OAuth2PkceAuthorization
  | ApiKeyAuthorization;

// ============= Certificate and Proxy Interfaces =============

export interface Certificate {
  id: string;
  name: string;
  host: string;
  certFile?: string;
  keyFile?: string;
  passphrase?: string;
}

export interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  bypass?: string[];
}

// ============= Defaults Interface =============

export interface Defaults {
  selectedAuthorization?: SelectedItem;
  selectedCertificate?: SelectedItem;
  selectedProxy?: SelectedItem;
  selectedScenario?: SelectedItem;
}

// ============= Main Workbook Interface =============

export interface ApicizeWorkbook {
  version: number;
  requests: Array<Request | RequestGroup>;
  scenarios?: Scenario[];
  authorizations?: Authorization[];
  certificates?: Certificate[];
  proxies?: Proxy[];
  data?: ExternalData[];
  defaults?: Defaults;
}

// ============= Response Interfaces =============

export interface ApicizeResponseHeaders {
  [key: string]: string | string[];
}

export interface ApicizeResponseBody {
  type: BodyType;
  data?: unknown;
  text?: string;
  size?: number;
}

export interface ApicizeResponse {
  status: number;
  statusText: string;
  headers: ApicizeResponseHeaders;
  body: ApicizeResponseBody;
  timing?: {
    started: number;
    dns?: number;
    tcp?: number;
    tls?: number;
    request?: number;
    firstByte?: number;
    download?: number;
    total: number;
  };
  redirects?: Array<{
    url: string;
    status: number;
  }>;
}

// ============= Execution Context Interfaces =============

export interface ApicizeContext {
  workbook: ApicizeWorkbook;
  scenario?: Scenario;
  variables: Record<string, unknown>;
  $: Record<string, unknown>;
  output: (key: string, value: unknown) => void;
  execute: (request: RequestConfig) => Promise<ApicizeResponse>;
  substituteVariables: (text: string) => string;
  headers?: NameValuePair[];
  body?: RequestBody;
}

export interface RequestConfig {
  url: string;
  method: HttpMethod | string;
  headers?: NameValuePair[] | Record<string, string>;
  body?: RequestBody | string | Buffer | Record<string, unknown>;
  timeout?: number;
  numberOfRedirects?: number;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  keepAlive?: boolean;
  acceptInvalidCerts?: boolean;
  mode?: RequestMode;
  referrer?: string;
  referrerPolicy?: string;
  duplex?: string;
  queryStringParams?: NameValuePair[];
  auth?: string;
  service?: string;
  endpoint?: string;
  path?: string;
}

// ============= Test Helper Types =============

export interface TestHelper {
  setupTest(testName: string): Promise<ApicizeContext>;
  loadScenario(scenarioId: string): Promise<Scenario>;
  loadData(dataId: string): Promise<unknown>;
}

// ============= Metadata Types =============

export interface ApicizeMetadata {
  id: string;
  url?: string;
  method?: HttpMethod;
  headers?: NameValuePair[];
  body?: RequestBody;
  queryStringParams?: NameValuePair[];
  timeout?: number;
  numberOfRedirects?: number;
  runs?: number;
  multiRunExecution?: ExecutionMode;
  execution?: ExecutionMode;
  selectedScenario?: SelectedItem;
  selectedData?: SelectedItem;
  [key: string]: unknown;
}

export interface FileMetadata {
  version: number;
  source: string;
  exportDate: string;
}

export interface GroupMetadata {
  id: string;
  execution?: ExecutionMode;
  selectedScenario?: SelectedItem;
  selectedData?: SelectedItem;
}

// ============= Configuration Types =============

export interface ApicizeConfig {
  version: string;
  activeEnvironment: string;
  libPath: string;
  configPath: string;
  testsPath: string;
  dataPath: string;
  reportsPath: string;
  settings: {
    defaultTimeout: number;
    retryAttempts: number;
    parallelExecution: boolean;
    verboseLogging: boolean;
    preserveMetadata: boolean;
  };
  imports: {
    autoGenerateIds: boolean;
    validateOnImport: boolean;
    preserveComments: boolean;
  };
  exports: {
    includeMetadata: boolean;
    generateHelpers: boolean;
    splitByGroup: boolean;
  };
}

export interface EnvironmentConfig {
  name: string;
  baseUrls: Record<string, string>;
  headers?: Record<string, string>;
  timeouts?: {
    default: number;
    long: number;
    [key: string]: number;
  };
  features?: Record<string, boolean>;
}

export interface AuthProviderConfig {
  type: AuthorizationType;
  config: Record<string, unknown>;
}

export interface AuthProvidersConfig {
  providers: Record<string, AuthProviderConfig>;
}

// ============= Utility Types =============

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequestOrGroup = Request | RequestGroup;

export function isRequest(item: RequestOrGroup): item is Request {
  return 'url' in item && 'method' in item;
}

export function isRequestGroup(item: RequestOrGroup): item is RequestGroup {
  return 'children' in item;
}

// ============= Export Convenience Type Guards =============

export function isBodyTypeJSON(body: RequestBody): body is RequestBodyJSON {
  return body.type === BodyType.JSON;
}

export function isBodyTypeText(body: RequestBody): body is RequestBodyText {
  return body.type === BodyType.Text;
}

export function isBodyTypeForm(body: RequestBody): body is RequestBodyForm {
  return body.type === BodyType.Form;
}

export function isBodyTypeXML(body: RequestBody): body is RequestBodyXML {
  return body.type === BodyType.XML;
}

export function isBodyTypeRaw(body: RequestBody): body is RequestBodyRaw {
  return body.type === BodyType.Raw;
}

export function isBodyTypeNone(body: RequestBody): body is RequestBodyNone {
  return body.type === BodyType.None;
}
