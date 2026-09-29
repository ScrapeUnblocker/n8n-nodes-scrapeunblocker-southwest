import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OptionField } from './GenericFunctions';
import { applyOptions, requireString, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "Southwest Airlines Flight Fares Scraper" Actor: https://apify.com/scrapeunblocker/southwest-scraper
const ACTOR_ID = 'QxOxy1gmeeqHdkxa8';
const INTEGRATION_APP_ID = 'scrapeunblocker-southwest-scraper';

// Node option name -> Actor input key.
const OPTION_FIELDS: Record<string, OptionField> = {
	returnDate: {
		key: 'return_date',
	},
	fareType: {
		key: 'fare_type',
	},
	adults: {
		key: 'adults',
	},
	proxyCountry: {
		key: 'proxy_country',
		kind: 'upper',
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'flight:search': {
			input.origin = requireString.call(this, 'origin', 'Origin Airport', itemIndex).toUpperCase();
			input.dest = requireString.call(this, 'dest', 'Destination Airport', itemIndex).toUpperCase();
			input.depart_date = requireString.call(this, 'departDate', 'Departure Date', itemIndex);
			break;
		}
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex },
			);
	}

	applyOptions(input, options, OPTION_FIELDS);
	return input;
}

export class SouthwestAirlinesFlightFaresScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Southwest Airlines Flight Fares Scraper',
		name: 'southwestAirlinesFlightFaresScraper',
		icon: {
			light: 'file:southwestAirlinesFlightFaresScraper.png',
			dark: 'file:southwestAirlinesFlightFaresScraper.dark.png',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Get live Southwest Airlines fares for a route and date with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'Southwest Airlines Flight Fares Scraper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Flight',
						value: 'flight',
					},
				],
				default: 'flight',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['flight'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search Southwest flights and fares between two airports',
						action: 'Search flights',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Origin Airport',
				name: 'origin',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'DAL',
				description:
					"3-letter IATA code of the airport to fly from, e.g. 'DAL' (Dallas Love Field) or 'LAS' (Las Vegas)",
				displayOptions: {
					show: {
						resource: ['flight'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Destination Airport',
				name: 'dest',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'HOU',
				description:
					"3-letter IATA code of the airport to fly to, e.g. 'HOU' (Houston Hobby) or 'MDW' (Chicago Midway)",
				displayOptions: {
					show: {
						resource: ['flight'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Departure Date',
				name: 'departDate',
				type: 'string',
				required: true,
				default: '',
				placeholder: '2026-11-10',
				description: 'Outbound date as YYYY-MM-DD',
				displayOptions: {
					show: {
						resource: ['flight'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Adult Passengers',
						name: 'adults',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 8,
						},
						default: 1,
						description: 'Number of adult passengers (1-8)',
					},
					{
						displayName: 'Fare Type',
						name: 'fareType',
						type: 'options',
						options: [
							{
								name: 'Rapid Rewards Points',
								value: 'points',
							},
							{
								name: 'US Dollars',
								value: 'dollars',
							},
						],
						default: 'dollars',
						description:
							'Price the fares in US dollars or in Rapid Rewards points. One run returns one of the two.',
					},
					{
						displayName: 'Proxy Country',
						name: 'proxyCountry',
						type: 'string',
						default: 'US',
						placeholder: 'US',
						description:
							'Exit-IP country (ISO-2). Southwest is a US airline, so the default US is recommended.',
					},
					{
						displayName: 'Return Date',
						name: 'returnDate',
						type: 'string',
						default: '',
						placeholder: '2026-11-13',
						description:
							'Return date as YYYY-MM-DD for a round trip. Leave blank for a one-way search.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const { timeout, ...actorOptions } = options;

				const input = buildActorInput.call(this, resource, operation, actorOptions, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (timeout as number) || undefined,
				});

				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
