var data;

function init() {
	var jsonInput = document.getElementById('jsonResponse');

	jsonInput.addEventListener('submit', parseInput);
}

function parseInput(e) {
	e.preventDefault();
	var value = e.currentTarget.querySelector('#json-input').value;
	
	if(value.length > 0) {
		try {
			tempResult = JSON.parse(value);
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
	var image = new Image(imgData.image.shape[0], imgData.image.shape[1]);
	image.onload = drawImageAtSize;
	image.src = imgData.image.url;

	var context = canvas.getContext('2d');

	function drawImageAtSize() {
		canvas.width = this.naturalWidth;
		canvas.height = this.naturalHeight;
		context.drawImage(this, 0, 0);

		drawSquares(imgData.faces, context);
	}

}

function drawSquares(faces, context) {
	for(var i = 0; i < faces.length; ++i) {
		var pos = faces[i].coordinates;
		context.strokeStyle = (faces[i].gender === "man")?"blue":"red";
		context.lineWidth = 2;
		context.strokeRect(pos.point[0],pos.point[1],pos.width,pos.height);
	}
}



document.addEventListener('DOMContentLoaded', function() {
	init();
});