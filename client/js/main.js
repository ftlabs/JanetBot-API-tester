var data;

function init() {
	var jsonInput = document.getElementById('jsonResponse');
	var buttons = document.querySelectorAll('.fetch-results');

	jsonInput.addEventListener('submit', parseInput);
	Array.from(buttons).forEach(function(button) {
		button.addEventListener('click', getJBData);
	});
}

function getJBData(e) {
	var edition = e.currentTarget.id.split('-')[1];
	var url = new URL(window.location.href+'janetbot?v='+edition);

	fetch(url)
		.then(function(res){
			return res.json();
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
		})
		.catch(function(err){
			console.log(err);
		});
}

function parseInput(e) {
	e.preventDefault();

	var classifierText = e.currentTarget.querySelector('#classifier-input').value;
	var jsonText = e.currentTarget.querySelector('#json-input').value;

	if(classifierText.length > 0) {
		console.log(`DEBUG: parsing classifierText`);
		// expecting classifierText to be:
		//to override url: api=VALUE note: do not add endpoint
		// bodyparam=VALUE
		// bodyparam=VALUE
		// bodyparam=VALUE
		// bodyparam=VALUE

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
				
				var jsonDataObj = document.querySelector('.json-data');
				jsonDataObj.textContent = JSON.stringify(imgResults, null, '\t');

				var origin = document.querySelector('.image-container');
				getImage(imgResults, origin.querySelector('.output'));
			})
			.catch(function(err) {
				console.log(err);
			});
	} else if(jsonText.length > 0) {
		try {
			var tempResult = JSON.parse(jsonText);
			data = {results: [{apiResults: tempResult}]};
			var origin = document.querySelector('.image-container');

			if(tempResult.faces.length > 0) {
				getImage(tempResult, origin.querySelector('.output'));
			} else {
				alert('No faces');
			}
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
			});
			reader.readAsText(files[0]);
		}
	}
}

function getImage(imgData, canvas) {
	var xShrunkBy = 1.0;
	var yShrunkBy = 1.0;

	// added to re-scale the boxes to the correct size if the classifyImage service shrank the image before processing
	if (imgData.hasOwnProperty('shrunk')) {
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


document.addEventListener('DOMContentLoaded', init);
