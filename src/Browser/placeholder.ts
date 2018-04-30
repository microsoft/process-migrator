/// <reference types="vss-web-extension-sdk" />
import * as WITInterfaces from "vso-node-api/interfaces/WorkItemTrackingInterfaces";
import * as WITProcessDefinitionsInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessDefinitionsInterfaces";
import * as WITProcessInterfaces from "vso-node-api/interfaces/WorkItemTrackingProcessInterfaces";
import { WorkItemTrackingApi } from "vso-node-api/WorkItemTrackingApi";
import { getCollectionClient } from "VSS/Service";
import { WorkItemTrackingHttpClient } from "TFS/WorkItemTracking/RestClient";

// Placeholder file for proof of concept
const witClient = getCollectionClient<WorkItemTrackingHttpClient>(WorkItemTrackingHttpClient);
const booleanType = WITInterfaces.FieldType.Boolean;
const customPageType = WITProcessDefinitionsInterfaces.PageType.Custom;