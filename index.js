const api_url = 'https://ws.audioscrobbler.com/2.0'

const apiRequest = (method, url, auth, params, callback) => {

	params.api_key = settings.clientIds.lastfm.client_id
	params.method = url
	
	if (auth) params.sk = settings.lastfm.session_key

	params.api_sig = createSig(params)

	params.format = 'json'

	let requestOptions = { url: api_url, method: method, json: true}

	switch (method) {
		case 'GET':
			let urlParameters = Object.keys(params).map((i) => typeof params[i] !== 'object' ? i+'='+params[i]+'&' : '' ).join('') // transforms to url format everything except objects
			requestOptions.url += '?'+urlParameters
			break
		case 'POST':
			requestOptions.form = params
			break
		case 'PUT':
		case 'DELETE':
			requestOptions.json = params
			break
	}

	request(requestOptions, (err, result, body) => {
		if (body && body.error) callback(body.error, body)
		else callback(err, body)
	})
	
}

const createSig = (params) => {
	let sig = ""
	Object.keys(params).sort().forEach(function(key) {
		if (key != "format") {
			let value = typeof params[key] !== "undefined" && params[key] !== null ? params[key] : ""
			sig += key + value
		}
	})
	sig += settings.clientIds.lastfm.client_secret
	return md5(sig)
}

const convertTrack = rawTrack => {
	return {
		'service': 'lastfm',
		'title': rawTrack.name,
		'artist': {
			'id': rawTrack.artist.mbid,
			'name': rawTrack.artist.name
		},
		'album': {
			'id': '',
			'name': ''
		},
		'share_url': rawTrack.url,
		'id': rawTrack.url,
		'artwork': rawTrack.image[0]['text']
	}
}

class Lastfm {

	/**
	* Called when user wants to activate the service
	*
	* @param callback {function}
	*/

	static login (callback) {
		const oauthUrl =`http://www.last.fm/api/auth?api_key=${settings.clientIds.lastfm.client_id}`
		oauthLogin(oauthUrl, (code) => {

			if (!code) return callback('stopped')

			apiRequest('GET', 'auth.getsession', false, {token: code} , (err, res) => {
				
				if (err) {
					settings.lastfm.error = true
					return callback(err)
				}
				
				settings.lastfm.session_key = res.session.key

				callback()

			})
		})
	}

	/**
	* Called every time a track is played
	*
	* @param callback {Object}
	*/
	static onTrackPlay (track) {
		if (settings.lastfm.tempDisable) return

		const duration = track.duration / 1000

		apiRequest('POST', 'track.updateNowPlaying', true, { track: track.title, artist: track.artist.name, duration: duration }, err => {
			if (err) console.error(err) 
		})
	}

	/**
	* Called every time a track ended
	*
	* @param callback {Object}
	*/
	static onTrackEnded (track) {
		if (settings.lastfm.tempDisable) return
		
		const timestamp = Math.floor(Date.now() / 1000) - Math.floor(track.duration / 1000)

		apiRequest('POST', 'track.scrobble', true, { track: track.title, artist: track.artist.name, timestamp: timestamp }, err => {
			if (err) console.error(err)
		})
	}


	/**
	* Show similar tracks based on seed
	*
	* @param track {Object}
	*/
	static showSimilar (tracks) {
		let track = tracks[0];

		specialView('lastfm', 'loading', 'similar tracks', track.title, track.artwork);

		apiRequest('GET', 'track.getsimilar', false, { track: track.title, artist: track.artist.name, limit: 50 }, (err, res) => {
			let tracks = [];

			if (err) console.error(err)
			else {
				for (let tr of res.similartracks.track)
					tracks.push(convertTrack(tr))
			}

			specialView('lastfm', tracks, 'similar tracks', track.title, track.artwork);
		})
	}

	/*
	* Returns the settings items of this plugin
	*
	*/
	static settingsItems () {
		return [
			{
				type: 'activate',
				id: 'active'
			},
			{
				description: 'Disable scrobbling',
				type: 'checkbox',
				id: 'tempDisable'
			}
		]
	}

	/*
	* Returns the context menu items of this plugin
	*
	* @param tracks {Array of Objects} The selected tracks object
	*/
	static contextmenuItems (tracks) {
		return [ 
			{
				label: 'Show similar tracks',
				click: () => Lastfm.showSimilar(tracks)
			}
		]
	}

}


/** Static Properties **/
Lastfm.isGeneralPlugin = true

Lastfm.settings = {
	active: false,
	tempDisable: false
}

module.exports = Lastfm