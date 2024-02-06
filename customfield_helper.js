const serverAddress = process.env.FAVRO_URL;
const userEmail = process.env.FAVRO_CALCULATOR_USER;
const userPassword = process.env.FAVRO_CALCULATOR_TOKEN;
const organizationId = process.env.FAVRO_ORG_ID;

const authorizationHeader = "Basic " + btoa(userEmail + ":" + userPassword);

function getHeaders() {
	return {
		"Authorization": authorizationHeader,
		"Content-Type": "application/json",
		"organizationId": organizationId,
	}
}

const getOptions = { method: "GET", headers: getHeaders(), };

// Step 1: Get all custom fields
function stepOne() {
	// In this example, we're only getting 1 page, you may want to extend this with pagination
	// Link: https://favro.com/developer/#pagination
	fetch(serverAddress + "customfields", getOptions)
		.then(response => response.json())
		.then((body) => console.log(body));
}

// Step 2: Extract the items for each custom field
function stepTwo() {
	// Update these with the ids you got from the first step
	const acceptedCustomFieldIds = [
		"reachCustomFieldId",
		"impactCustomFieldId",
		"confidenceCustomFieldId",
		"effortCustomFieldId",
	];

	for (customFieldId of acceptedCustomFieldIds) {
		if (customFieldId.indexOf("CustomFieldId") != -1) {
			console.error(customFieldId + " needs to be updated with the id you got from the first step")
			process.exit(1);
		}
	}

	function valueFromIndex(index) {
		switch (index) {
			case 0: return 1;
			case 1: return 3;
			case 2: return 5;
			case 3: return 8;
			case 4: return 10;
			default:
				console.error("error");
		}
	}

	function format(id, items) {
		let formattedItems = items.map((item, index) => { return { id: item.customFieldItemId, value: valueFromIndex(index) } });
		return {
			customField: id,
			items: formattedItems,
		}
	}

	for (let customFieldId of acceptedCustomFieldIds) {
		fetch(serverAddress + "customfields/" + customFieldId, getOptions)
			.then(response => response.json())
			.then((body) => console.log(format(body.customFieldId, body.customFieldItems)));
	}
}

stepOne();
// stepTwo();

