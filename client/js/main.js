var data;

function init() {
	var jsonInput = document.getElementById('jsonResponse');
	var buttons = document.querySelectorAll('.fetch-results');

	jsonInput.addEventListener('submit', parseInput);
	Array.from(buttons).forEach(function(button) {
		button.addEventListener('click', getJBData);
	});

	loadCachedParams();
}

function getJBData(e) {
	var edition = e.currentTarget.id.split('-')[1];
	var url = new URL(window.location.href+'janetbot?v='+edition);

	fetch(url)
		.then(function(res){
			if(res.status === 200) {
				return res.json();	
			} else {
				throw Error(res.status);
			}
		})
		.then(function(data){
			data = data;
			var origin = document.querySelector('.image-container');

			for(var i = 0; i < data.content.length; ++i) {
				var duplicate = origin.cloneNode(true);
				duplicate.setAttribute('id', i);

				var objDetails = duplicate.querySelector('.object-data');
				var results = JSON.parse(data.content[i].rawResults);
				objDetails.textContent = JSON.stringify(results, null, '\t');

				var canvas = duplicate.querySelector('.output');
				canvas.setAttribute('id', 'output'+i);
				getImage(results, canvas);

				document.body.appendChild(duplicate);
			}
			
			hideParams();
		})
		.catch(function(err){
			if(err.toString().includes('404')) {
				alert('Service not found, check service URL');
			} else {
				alert('Access forbidden, check your service tokens');
			}
		});
}

function parseInput(e) {
	e.preventDefault();

	var classifierText = e.currentTarget.querySelector('#classifier-input').value;
	var jsonText = e.currentTarget.querySelector('#json-input').value;

	if(classifierText.length > 0) {
		console.log(`DEBUG: parsing classifierText`);
		deleteCachedParams('json');

		var bodyParamsStrings = [];

		var lines = classifierText.split(/\n/);

		Array.from(lines).forEach( function(line) {
			var mBodyParam = line.match(/^([^=]+)=(.+)$/);
			if (mBodyParam) {
				var paramString = mBodyParam[1] + '=' + encodeURIComponent(mBodyParam[2]);
				bodyParamsStrings.push( paramString );
				console.log('DEBUG: parsing paramString=', paramString);
			}
		})

		var bodyText = bodyParamsStrings.join('&');

		var serverURL = new URL(window.location.href+'api');
		var options = {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
		    	'Content-Type': 'application/x-www-form-urlencoded'
		  	},
		  	body: bodyText
		}

		fetch(serverURL, options)
			.then(function(res){
				return res.json();
			})
			.then(function(data) {
				data = data;
				var imgResults = JSON.parse(data.results[0].apiResults);
				
				var jsonDataObj = document.querySelector('.object-data');
				jsonDataObj.textContent = JSON.stringify(imgResults, null, '\t');

				var origin = document.querySelector('.image-container');
				getImage(imgResults, origin.querySelector('.output'));
				hideParams();
			})
			.catch(function(err) {
				console.log(err);
			});
	} else if(jsonText.length > 0) {
		deleteCachedParams('classifier');
		try {
			var tempResult = JSON.parse(jsonText);
			data = {results: [{apiResults: tempResult}]};
			var origin = document.querySelector('.image-container');
			var jsonDataObj = document.querySelector('.object-data');
			jsonDataObj.textContent = jsonText;

			getImage(tempResult, origin.querySelector('.output'));
			hideParams();

		} catch(e) {
			alert('Invalid JSON');
			return;
		}
	} else {
		var files = e.currentTarget.querySelector('#files').files;
		if(files[0].type === "application/json") {
			var reader = new FileReader();
			reader.addEventListener('load', function() {
				data = JSON.parse(reader.result);
				var origin = document.querySelector('.image-container');

				for(var i = 0; i < data.results.length; ++i) {
					var duplicate = origin.cloneNode(true);
					duplicate.setAttribute('id', i);

					var objDetails = duplicate.querySelector('.object-data');
					objDetails.textContent = JSON.stringify(data.results[i].apiResults, null, '\t');

					var canvas = duplicate.querySelector('.output');
					canvas.setAttribute('id', 'output'+i);

					getImage(data.results[i].apiResults, canvas);

					document.body.appendChild(duplicate);
				}

				hideParams();
			});
			reader.readAsText(files[0]);
		}
	}
}

function getImage(imgData, canvas) {
	var xShrunkBy = 1.0;
	var yShrunkBy = 1.0;

	// added to re-scale the boxes to the correct size if the classifyImage service shrank the image before processing
	if (imgData.hasOwnProperty('shrunk') && imgData.shrunk.hasOwnProperty('to') ) {
		xShrunkBy = imgData.shrunk.to.width  / imgData.shrunk.from.width ;
		yShrunkBy = imgData.shrunk.to.height / imgData.shrunk.from.height;
	}

	var image = new Image(imgData.image.shape[0], imgData.image.shape[1]);
	image.onload = drawImageAtSize;
	image.src = imgData.image.url;

	var context = canvas.getContext('2d');

	function drawImageAtSize() {
		canvas.width = this.naturalWidth;
		canvas.height = this.naturalHeight;
		context.drawImage(this, 0, 0);

		drawSquares(imgData.faces, context, xShrunkBy, yShrunkBy);
	}

}

function drawSquares(faces, context, xShrunkBy=1.0, yShrunkBy=1.0) {
	for(var i = 0; i < faces.length; ++i) {
		var face = faces[i];
		var pos = face.coordinates;
		context.setLineDash([]);
		context.strokeStyle = (face.gender === "man")?"blue":"red";
		context.lineWidth = 2;
		context.strokeRect(
			pos.point[0]/xShrunkBy, pos.point[1]/yShrunkBy,
			pos.width   /xShrunkBy, pos.height  /yShrunkBy
		);
		if (face.hasOwnProperty('offsets')) {
			context.setLineDash([5]);
			var pos = face.offsets.coordinates;
			context.strokeRect(
				pos.point[0]/xShrunkBy, pos.point[1]/yShrunkBy,
				pos.width   /xShrunkBy, pos.height  /yShrunkBy
			);
		}
	}
}

function hideParams() {
	var jsonInput = document.getElementById('json-input');
	var classifierInput = document.getElementById('classifier-input');

	if(jsonInput.value !== '' || classifierInput.value !== '') {
		cacheParams(jsonInput.value, classifierInput.value);
	}

	var params = document.getElementById('parameters');
	params.classList.add('hidden');
}

function cacheParams(jsonValue, classifierValue) {
	if(jsonValue !== '') {
		window.localStorage.setItem('JB_tester_json', JSON.stringify(jsonValue));
	}

	if(classifierValue !== '') {
		window.localStorage.setItem('JB_tester_classifier', JSON.stringify(classifierValue));
	}
}

function deleteCachedParams(param) {
	if(param === 'json') {
		var jsonInput = document.getElementById('json-input');
		jsonInput.value = '';
		window.localStorage.removeItem('JB_tester_json');
	} else if (param === 'classifier') {
		var classifierInput = document.getElementById('classifier-input');
		classifierInput.value = '';

		window.localStorage.removeItem('JB_tester_classifier');
	}
}

function loadCachedParams() {
	var jsonValue = window.localStorage.getItem('JB_tester_json');
	var classifierValue = window.localStorage.getItem('JB_tester_classifier');

	if(jsonValue !== null) {
		jsonValue = JSON.parse(jsonValue);

		var jsonInput = document.getElementById('json-input');
		jsonInput.value = jsonValue;
	}

	if(classifierValue !== null) {
		classifierValue = JSON.parse(classifierValue);
		var classifierInput = document.getElementById('classifier-input');
		classifierInput.value = classifierValue;
	}
}


document.addEventListener('DOMContentLoaded', init);
