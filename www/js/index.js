var googleapi = {
    setToken: function(data) {
        //Cache the token
        localStorage.access_token = data.access_token;
        //Cache the refresh token, if there is one
        localStorage.refresh_token = data.refresh_token || localStorage.refresh_token;
        //Figure out when the token will expire by using the current
        //time, plus the valid time (in seconds), minus a 1 minute buffer
        var expiresAt = new Date().getTime() + parseInt(data.expires_in, 10) * 1000 - 60000;
        localStorage.expires_at = expiresAt;
    },
    authorize: function(options) {
        var deferred = $.Deferred();

        //Build the OAuth consent page URL
        var authUrl = 'https://accounts.google.com/o/oauth2/auth?' + $.param({
            client_id: options.client_id,
            redirect_uri: options.redirect_uri,
            response_type: 'code',
            scope: options.scope
        });

        //Open the OAuth consent page in the InAppBrowser
        var authWindow = window.open(authUrl, '_blank', 'location=no,toolbar=no');

        //The recommendation is to use the redirect_uri "urn:ietf:wg:oauth:2.0:oob"
        //which sets the authorization code in the browser's title. However, we can't
        //access the title of the InAppBrowser.
        //
        //Instead, we pass a bogus redirect_uri of "http://localhost", which means the
        //authorization code will get set in the url. We can access the url in the
        //loadstart and loadstop events. So if we bind the loadstart event, we can
        //find the authorization code and close the InAppBrowser after the user
        //has granted us access to their data.
        authWindow.addEventListener('loadstart', googleCallback);
        function googleCallback(e){
            var url = (typeof e.url !== 'undefined' ? e.url : e.originalEvent.url);
            var code = /\?code=(.+)$/.exec(url);
            var error = /\?error=(.+)$/.exec(url);

            if (code || error) {
                //Always close the browser when match is found
                authWindow.close();
            }

            if (code) {
                //Exchange the authorization code for an access token
                $.post('https://accounts.google.com/o/oauth2/token', {
                    code: code[1],
                    client_id: options.client_id,
                    client_secret: options.client_secret,
                    redirect_uri: options.redirect_uri,
                    grant_type: 'authorization_code'
                }).done(function(data) {
                    googleapi.setToken(data);
                    deferred.resolve(data);
                }).fail(function(response) {
                	alert(JSON.stringify(response));
                    deferred.reject(response.responseJSON);
                });
            } else if (error) {
                //The user denied access to the app
                deferred.reject({
                    error: error[1]
                });
            }
        }

        return deferred.promise();
    },
    getToken: function(options) {
        var deferred = $.Deferred();

        if (new Date().getTime() < localStorage.expires_at) {
            deferred.resolve({
                access_token: localStorage.access_token
            });
        } else if (localStorage.refresh_token) {
            $.post('https://accounts.google.com/o/oauth2/token', {
                refresh_token: localStorage.refresh_token,
                client_id: options.client_id,
                client_secret: options.client_secret,
                grant_type: 'refresh_token'
            }).done(function(data) {
                googleapi.setToken(data);
                deferred.resolve(data);
            }).fail(function(response) {
                deferred.reject(response.responseJSON);
            });
        } else {
            deferred.reject();
        }

        return deferred.promise();
    },
    userInfo: function(options) {
        return $.getJSON('https://www.googleapis.com/oauth2/v1/userinfo', options);
    }
};

var app = {
    client_id: '61901777981-a878j7kc5rsom9kdgm52ed3t2vsvun7u.apps.googleusercontent.com',
    client_secret: '4zVA9Y_1c5LvsmMKc-l3Vh68',
    redirect_uri: 'http://127.0.0.1:3000',
    scope: 'https://www.googleapis.com/auth/userinfo.profile',

    init: function() {
	    	alert("App Start");
	    	// Expiring the token generated on app start
	    	localStorage.expires_at = 0;
	        $('#login a').on('click', function() {
	            app.onLoginButtonClick();
	        });

	        $(".logout").on("click", function(){
	        	$.post('https://accounts.google.com/Logout?continue=http://google.com', {}).done(function(data) {
	        		alert("Logged out from google");
	        	}).fail(function(response) {
           
        		});
	        });

	        //Check if we have a valid token
	        //cached or if we can get a new
	        //one using a refresh token.
	        googleapi.getToken({
	            client_id: app.client_id,
	            client_secret: app.client_secret
	        }).done(function() {
	            //Show the greet view if we get a valid token
	            app.showGreetView();
	        }).fail(function() {
	            //Show the login view if we have no valid token
	            app.showLoginView();
	        });	
        


    },
    showLoginView: function() {
    	alert("Show login view");
        $('#login').show();
        $('#greet').hide();
    },
    showGreetView: function() {
    	alert("Successfully logged in");
        $('#login').hide();
        $('#greet').show();

        //Get the token, either from the cache
        //or by using the refresh token.
        googleapi.getToken({
            client_id: app.client_id,
            client_secret: app.client_secret
        }).then(function(data) {
            //Pass the token to the API call and return a new promise object
            return googleapi.userInfo({ access_token: data.access_token });
        }).done(function(user) {
            //Display a greeting if the API call was successful
            alert("Display a greeting if the API call was successful and data is obtained from server");
            $('#greet h1').html('Hello ' + user.name + '!');
        }).fail(function() {
            //If getting the token fails, or the token has been
            //revoked, show the login view.
            app.showLoginView();
        });
    },
    onLoginButtonClick: function() {
    	alert("Login Clicked");
        //Show the consent page
        googleapi.authorize({
            client_id: app.client_id,
            client_secret: app.client_secret,
            redirect_uri: app.redirect_uri,
            scope: app.scope
        }).done(function() {
        	alert("authorize success");
            //Show the greet view if access is granted
            app.showGreetView();
        }).fail(function(data) {
        	alert(JSON.stringify(data));
        	alert("authorize failed");
            //Show an error message if access was denied
            $('#login p').html(data.error);
        });
    }
};

$(document).on('deviceready', function() {
    app.init();
});
