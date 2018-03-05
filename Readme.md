# JanetBot API tester

## Setup
Clone the repo and run `npm install`.

At root, create a `data/` folder and a `results/` (will be written to by the app) folder.

In the `data/` folder, unpack the datasets, ensuring that folders such as `00/`, `01/`, etc. are direct children of `data/`.

Also in this folder, add `data.json` containing the associated metadata for the images.

## Requirements
This app requires `ngrok` to be running as the API will only fetch and analyse images from a url.


Once you have your ngrok instance running, add the https url as `LOCAL_URL` in a `.env` file.


Note, the API url needs to be added as `JANETBOT_API` in the same file.

In `index.js`, fill in `selectedSubset` with desired parameters (see below).

Save, and run `npm start`. This will send the selected images to be analysed and save the results as a json file in `results`. 
A console output will show the file name.

### selectedSubsetParams
- **type**: can be `'sample'` (will pick some images from the folders) or `'folders'` (will analyse entire folders)
- **folders**: an array of folder names to get images from

_Only available in 'sample' mode:_ 

- **quantity**: The number of images to select in each folder
- **from**: The index to start from (e.g. the first image is 0)
- **sampleOrder**: can be `'consecutive'` or `'random'` (will choose random images in each folder, based on start index and quantity)