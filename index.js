if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const express = require('express');
const path = require('path');
const s3o = require('@financial-times/s3o-middleware');
const app = express();
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');

const selectedSubset = {
	type: 'sample',
	folders: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'],
	quantity: 5,
	from: 10,
	sampleOrder: 'random'
};
//TODO later: move params to client for local dev

let metadata;


app.use(express.static(path.resolve(__dirname + "/data")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const localURL = process.env.LOCAL_URL;

app.get('/janetbot', (req,res) => {
	const credentials = `${process.env.AUTH_USER}:${process.env.AUTH_TOKEN}`;
	const options = {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Basic ' + new Buffer(credentials).toString('base64')
		}
	};

	if(process.env.JANETBOT_URL) {
		fetch(`${process.env.JANETBOT_URL}${req.query.v}`, options)
			.then(res => {
				return res.json();
			})
			.then(data => {
				return res.json(data);
			})
			.catch(err => {
				console.log(err);
				res.sendStatus(403);
			});
	} else {
		console.log('NO API URL SPECIFIED');
		res.sendStatus(404);
	}
});

app.post('/api', (req, res) => {
	const params = formatParams(req.body);

	callAPI(params)
	.then(data => {
		return res.json({results: [data]});
	})
	.catch(err => {
		res.sendStatus(500);
	});
});

app.get('/test', (req, res) => {
	if(process.env.NODE_ENV === 'production') {
		res.send('This feature is only available locally');
	} else {
		fs.readFile(path.resolve(path.join(__dirname + "/data/data.json")), 'utf8', (err, data) => {
			if(err) {
				console.log('ERROR opening metadata', err);
				return;
			}

			metadata = JSON.parse(data).sort(sortByPath);
			analyseDataSet(getSubset(selectedSubset));
		});

		res.send('Analysis is running');
	}
	
});

app.use(s3o);
app.use(express.static(path.resolve(__dirname + "/client")));
app.get('/',  (req,res) => {
	res.sendStatus(200);
});

app.listen(process.env.PORT || 2018);


function getSubset(args) {
	const dataset = [];

	if(args.type === 'folders') {
		for(let i = 0; i < args.folders.length; ++i) {
			for(let j = 0; j < metadata.length; ++j) {
				if(metadata[j].full_path.startsWith(args.folders[i])) {
					dataset.push(metadata[j]);
				}
			}
		}
	} else if(args.type === 'sample') {
		for(let i = 0; i < args.folders.length; ++i) {
			let initIndex = -1;
			let initQuantity = -1;
			const randomSelection = [];

			for(let j = 0; j < metadata.length; ++j) {
				if(metadata[j].full_path.startsWith(args.folders[i])) {
					if(initIndex !== i) {
						initQuantity = j;
					}

					if(j >= (initQuantity + args.from)) {
						if(args.sampleOrder === 'consecutive') {
							if(j < (initQuantity + args.from + args.quantity)) {
								dataset.push(metadata[j]);		
							}
						} else if(args.sampleOrder === 'random') {
							const randomIndex = initQuantity + args.from + Math.floor(Math.random()*5000);

							if(randomSelection.indexOf(randomIndex) < 0 && randomSelection.length < args.quantity && indexIsInRange(randomIndex, args.folders[i])) {
								randomSelection.push(randomIndex);
								dataset.push(metadata[j]);
							}

						} else {
							console.log('ERROR:: sampleOrder value not supported');
							return;
						}
					}

					initIndex = i;
				}
			}
		}

	} else {
		console.log('ERROR:: Subset type not supported');
		return;
	}

	return dataset;
}

function indexIsInRange(index, folderNum) {
	return metadata[index].full_path.startsWith(folderNum);
}

async function analyseDataSet(subset = null) {
	const analysisResults = [];
	for(data in subset) {
		const result = await callAPI(`image=${localURL}/${subset[data].full_path}`);
		const formattedResult = (result.apiResults === undefined)?{apiResults: undefined}:{apiResults: JSON.parse(result.apiResults)};
		const savedData = await formatMetaData(subset[data]);

		Object.assign(savedData, formattedResult);

		savedData.conclusion = await checkClassification(savedData);
		analysisResults.push(savedData);
	}

	saveResults(analysisResults);
}

function saveResults(data) {
	const fileName = `${new Date().getTime()}__${selectedSubset.type}_${selectedSubset.folders.join('-')}`;

	const toSave = {
		subset: selectedSubset,
		results: data,
		stats: getStats(data)
	};

	fs.writeFile(path.resolve(path.join(__dirname + `/results/${fileName}.json`)), JSON.stringify(toSave, null, '\t'), 'utf8', err => {
		if (err) {
			console.log(data);
			throw err;
		}
		console.log(`File ${fileName} has been saved!`);
	});
}

function getStats(data) {
	let matchCount = 0;
	let wrongCount = 0;
	let noFaceCount = 0;
	let apiErrorCount = 0;

	for(let i = 0; i < data.length; ++i) {
		switch(data[i].conclusion.code) {
			case 0:
				++matchCount;
			break;
			case 1:
				++wrongCount;
			break;
			case 2:
				++noFaceCount;
			break;

			case 3:
			default:
				++apiErrorCount;
		}
	}

	return {totalSample: data.length, successRate: `${Math.round(100*matchCount/(data.length - apiErrorCount))}%`, matches: matchCount, wrong: wrongCount, noFace: noFaceCount, apiError: apiErrorCount };
}

async function checkClassification(data) {
	if(data.apiResults !== undefined) {
		const actual = data.apiResults.gender_counts;
		const expected = data.expectedGender;

		if(actual.female === 0 && actual.male === 0) {
			return {type: 'ERROR', code: 2, msg: 'No faces found'};
		} else if(actual[expected] > 0) {
			return {type: 'OK', code: 0, msg: 'At least one matching result'};
		}

		return {type: 'ERROR', code: 1, msg: 'Wrong classification'};
	}

	return {type: 'ERROR', code: 3, msg: 'No API result'};
}

async function formatMetaData(data) {
	const obj = {};

	obj.image = data.full_path;
	obj.expectedGender = data.gender.toLowerCase();
	obj.faces = {
		location: data.face_location,
		score: data.face_score,
		secondScore: data.second_face_score
	}

	return obj;
}

async function callAPI(params) {
	const rootUrl = params.api?params.api:process.env.JANETBOT_API;

	const options = {
		headers: {
			'Accept': 'application/json',
	    	'Content-Type': 'application/x-www-form-urlencoded'
	  	},
		method: 'POST',
		mode: 'cors',
		body: params.string
	};

	return fetch(`${rootUrl}/classifyImage`, options)
			.then(res => {
				if(res.ok) {
					return res.json();
				} else {
					if(res.status === 400) {
						console.log('MAKE SURE NGROK IS RUNNING');
					} else {
						console.log('API ERROR::', res.status);	
					}
				}

				return undefined;
			})
			.then(data => {
				return {apiResults: JSON.stringify(data)};
			})
			.catch(err => { console.log(err) });
}

function formatParams(obj) {
	const format = {};
	let params = [];

	for(let prop in obj) {
		if(prop === 'api') {
			format.api = obj[prop];
		} else {
			params.push(`${prop}=${encodeURIComponent(obj[prop])}`);	
		}
	}
	
	format.string = params.join('&');

	return format;
}

function sortByPath(a,b){
	if (a.full_path < b.full_path)
		return -1;
	if (a.full_path > b.full_path)
		return 1;
	return 0;
}