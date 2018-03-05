if (process.env.NODE_ENV !== 'production') require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const fetch = require('node-fetch');
const fs = require('fs');

const selectedSubset = {
	type: 'sample',
	folders: ['00', '01'],
	quantity: 5,
	from: 0,
	sampleOrder: 'consecutive'
} 

let metadata;

app.use(express.static(path.resolve(__dirname + "/data")));

const localURL = process.env.LOCAL_URL;

app.listen(process.env.PORT || 2018);

fs.readFile(path.resolve(path.join(__dirname + "/data/data.json")), 'utf8', (err, data) => {
	if(err) {
		console.log('ERROR opening metadata', err);
		return;
	}

	metadata = JSON.parse(data).sort(sortByPath);

	analyseDataSet(getSubset(selectedSubset));
});

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
		const result = await callAPI(subset[data].full_path);
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
		results: data
	};

	fs.writeFile(path.resolve(path.join(__dirname + `/results/${fileName}.json`)), JSON.stringify(toSave), 'utf8', err => {
		if (err) {
			console.log(data);
			throw err;
		}
		console.log(`File ${fileName} has been saved!`);
	});
}

async function checkClassification(data) {
	if(data.apiResults !== undefined) {
		const actual = data.apiResults.gender_counts;
		const expected = data.expectedGender;

		if(actual.female === 0 && actual.male === 0) {
			return {type: 'ERROR', msg: 'No faces found'};
		} else if(actual[expected] > 0) {
			return {type: 'OK', msg: 'At least one matching result'};
		}

		return {type: 'ERROR', msg: 'Wrong classification'};
	}

	return {type: 'ERROR', msg: 'No API result'};
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

async function callAPI(imgPath) {
	const postData = `image=${localURL}/${imgPath}`;
	console.log(postData);
	const options = {
		headers: {
			'Accept': 'application/json',
	    	'Content-Type': 'application/x-www-form-urlencoded'
	  	},
		method: 'POST',
		mode: 'cors',
		body: postData
	};

	return fetch(`${process.env.JANETBOT_API}/classifyImage`, options)
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

function sortByPath(a,b){
	if (a.full_path < b.full_path)
		return -1;
	if (a.full_path > b.full_path)
		return 1;
	return 0;
}