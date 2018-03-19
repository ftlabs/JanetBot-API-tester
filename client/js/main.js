var data;

function init() {
	var jsonInput = document.getElementById('jsonResponse');

	jsonInput.addEventListener('submit', parseInput);
}

function parseInput(e) {
	e.preventDefault();

	var classifierText = e.currentTarget.querySelector('#classifier-input').value;
	var jsonText       = e.currentTarget.querySelector('#json-input'      ).value;

	if(classifierText.length > 0) {
		console.log(`DEBUG: parsing classifierText`);
		// expecting classifierText to be:
		// http://classifier_url
		// bodyparam=VALUE
		// bodyparam=VALUE
		// bodyparam=VALUE
		// bodyparam=VALUE

		let classifierUrl = null;
		let bodyParamsStrings = [];

		let lines = classifierText.split(/\n/);

		let mUrl = lines[0].match(/^(http:.*)/);
		if( mUrl ) {
			classifierUrl = mUrl[1];
			console.log(`DEBUG: parsing classifierUrl=${classifierUrl}`);
		} else {
			alert(`no classifier url specified in 1st line`);
		}

		lines.slice(1).forEach( line => {
			let mBodyParam = line.match(/^([^=]+)=(.+)$/);
			if (mBodyParam) {
				let paramString = `${mBodyParam[1]}=${encodeURIComponent(mBodyParam[2])}`;
				bodyParamsStrings.push( paramString );
				console.log(`DEBUG: parsing paramString=${paramString}`);
			}
		})

		if(classifierUrl !== null){
			let bodyText = bodyParamsStrings.join('&');
			let xhr = new XMLHttpRequest();
			xhr.open("POST", classifierUrl, true);
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			xhr.onreadystatechange = function() {
				console.log(`classifier response received.`)
				if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
					try {
						let jsonText = xhr.response;
						console.log(`classifier response = ${jsonText}`)
						let tempResult = JSON.parse(jsonText);

						// display the JSON response from the classifier
						var jsonDataObj = document.querySelector('.json-data');
						jsonDataObj.textContent = jsonText;

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
				}
			}
			console.log(`DEBUG: POST ${classifierUrl}
${bodyText}`);
			xhr.send(bodyText);
		}

	} else if(jsonText.length > 0) {
		try {
			let tempResult = JSON.parse(jsonText);
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

	let xShrunkBy = 1.0;
	let yShrunkBy = 1.0;

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
		let face = faces[i];
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



document.addEventListener('DOMContentLoaded', function() {
	init();
});
