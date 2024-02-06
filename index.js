const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();

const serverAddress = process.env.FAVRO_URL;
const userEmail = process.env.FAVRO_CALCULATOR_USER;
const userPassword = process.env.FAVRO_CALCULATOR_TOKEN;
const organizationId = process.env.FAVRO_ORG_ID;
const webhookUrl = process.env.FAVRO_WEBHOOK_URL || "http://127.0.0.1:5000";
const webhookSecretKey = process.env.FAVRO_WEBHOOK_SECRET_KEY;

function checkEnvironmentVariables() {
	if (!serverAddress) {
		console.error("The server address has not been set.");
		process.exit(1);
	}

	if (!userEmail) {
		console.error("The user email has not been set.");
		process.exit(1);
	}

	if (!userPassword) {
		console.error("The user password has not been set.");
		process.exit(1);
	}

	if (!organizationId) {
		console.error("The workspace ID has not been set.");
		process.exit(1);
	}

	if (!webhookUrl) {
		console.error("The webhook url has not been set.");
		process.exit(1);
	}

	if (!webhookSecretKey) {
		console.error("The webhook secret has not been set.");
		process.exit(1);
	}
}

checkEnvironmentVariables();

const authorizationHeader = "Basic " + btoa(userEmail + ":" + userPassword);

function getHeaders() {
	return {
		"Authorization": authorizationHeader,
		"Content-Type": "application/json",
		"organizationId": organizationId,
	}
}

const putOptions = { method: "PUT", headers: getHeaders() };

// TODO: Update all these IDs based on your own setup
const riceScoreFieldId = "InsertRelevantId"; // RICE Score customfield id

const reachCustomField = {
	customFieldId: "InsertRelevantId", // Reach custom field id
	items: [
		{ id: "InsertRelevantId", value: 1 },  // None
		{ id: "InsertRelevantId", value: 3 },  // Minority
		{ id: "InsertRelevantId", value: 5 },  // Some
		{ id: "InsertRelevantId", value: 8 },  // Majority
		{ id: "InsertRelevantId", value: 10 }, // All
	]
};

const impactCustomField = {
	customFieldId: "InsertRelevantId", // Impact custom field id
	items: [
		{ id: "InsertRelevantId", value: 1 },  // No impact
		{ id: "InsertRelevantId", value: 3 },  // Minor inconvenience
		{ id: "InsertRelevantId", value: 5 },  // Moderate impact
		{ id: "InsertRelevantId", value: 8 },  // Significant impact
		{ id: "InsertRelevantId", value: 10 }, // Critical impact
	]
};

const confidenceCustomField = {
	customFieldId: "InsertRelevantId", // Confidence custom field id
	items: [
		{ id: "InsertRelevantId", value: 1 },  // No evidence
		{ id: "InsertRelevantId", value: 3 },  // Low
		{ id: "InsertRelevantId", value: 5 },  // Medium
		{ id: "InsertRelevantId", value: 8 },  // High
		{ id: "InsertRelevantId", value: 10 }, // Absolute certainty
	]
};

const effortCustomField = {
	customFieldId: "InsertRelevantId", // Efort custom field id
	items: [
		{ id: "InsertRelevantId", value: 1 },  // Trivial
		{ id: "InsertRelevantId", value: 3 },  // Minor
		{ id: "InsertRelevantId", value: 5 },  // Moderate
		{ id: "InsertRelevantId", value: 8 },  // Significant
		{ id: "InsertRelevantId", value: 10 }, // Major
	]
};
// End of configuration

function checkCustomFieldConfiguration(name, items) {
	if (!items.length) {
		console.error(name + " should have at least 1 id associated with it");
		process.exit(1);
	}

	for (item of items) {
		if (!item.id || item.id == "InsertRelevantId") {
			console.error("One of \"" + name + "\"'s ids has not been properly replaced");
			process.exit(1);
		}
	}
}

checkCustomFieldConfiguration("RICE Score", [{ id: riceScoreFieldId }])
checkCustomFieldConfiguration("Reach", reachCustomField.items)
checkCustomFieldConfiguration("Impact", impactCustomField.items)
checkCustomFieldConfiguration("Confidence", confidenceCustomField.items)
checkCustomFieldConfiguration("Effort", effortCustomField.items)

function findCustomFieldValue(card, customFieldToFind, defaultValue) {
	for (const cardCustomField of card.customFields) {
		if (cardCustomField.customFieldId != customFieldToFind.customFieldId)
			continue;

		if (cardCustomField.value.length == 0)
			break;

		const customFieldItems = customFieldToFind.items.filter((item) => item.id == cardCustomField.value[0]);
		if (customFieldItems.length == 0)
			break;

		return customFieldItems[0].value;
	}

	return defaultValue;	
}

function didScoreChange(card, newScore) {
	const cardRiceScoreField = card.customFields.filter(customField => customField.customFieldId == riceScoreFieldId);
	const oldRiceScore = cardRiceScoreField?.[0]?.total;
	return oldRiceScore != newScore;
}

function updateRICEScoreForCard(card) {
	const reach = findCustomFieldValue(card, reachCustomField, 0);
	if (reach == 0)
		return console.error("Reach is not set");

	const impact = findCustomFieldValue(card, impactCustomField, 0);
	if (impact == 0)
		return console.error("Impact is not set");

	const confidence = findCustomFieldValue(card, confidenceCustomField, 0);
	if (confidence == 0)
		return console.error("Confidence is not set");

	const effort = findCustomFieldValue(card, effortCustomField, 0);
	if (effort == 0)
		return console.error("Effort is not set");

	// Calculate score
	const riceScore = reach * impact * confidence / effort;

	// IMPORTANT:
	// When the card is updated via the API, the webhook will send an event that the card has been updated
	// This can create a loop and consume all your API quota
	// 
	// Therefore it is important not to update the card if the result has not changed
	// This is why the `didScoreChange` function is key here
	//
	// In general, pay attention to your calculations/your updates and how they interact with each other
	//
	// An alternative solution would be to not listen to the "update" webhook action and only handle "committed" and "moved"
	if (!didScoreChange(card, riceScore))
		return;

	// Update the RICE score in Favro
	fetch(serverAddress + "cards/" + card.cardId, {
		...putOptions,
		body: JSON.stringify({
			customFields: [{
				customFieldId: riceScoreFieldId,
				total: riceScore
			}]
		})
	}).catch(error => {
		if (error)
			console.error(error);
	});
}

function base64Digest(content) {
	return crypto.createHmac("sha1", webhookSecretKey).update(content).digest("base64");
}

function verifyWebhookRequest(payloadId, header) {
	// Double-HMAC to blind any timing channel attacks
	// https://www.isecpartners.com/blog/2011/february/double-hmac-verification.asp
	let content = payloadId + webhookUrl + "/calculator";
	let doubleHash = base64Digest(base64Digest(content));
	let headerHash = base64Digest(header);
	return doubleHash == headerHash;
}
function isValidWebhookAction(action) {
	return ["committed", "updated", "moved"].includes(action);
}

function getPort() {
	const url = new URL(webhookUrl);

	if (!url.port)
		return url.protocol === "https:" ? 443 : 80;

	return url.port;
}
app.listen(getPort(), function() {
	console.log("Listening on", webhookUrl);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/calculator", function(request, response) {
	let authOk = verifyWebhookRequest(request.body.payloadId, request.header("X-Favro-Webhook"));
	response.sendStatus(authOk ? 200 : 403);
	response.end();

	if (isValidWebhookAction(request.body.action))
		updateRICEScoreForCard(request.body.card);
});
