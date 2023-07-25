import { renderPage } from 'vite-plugin-ssr/server';
import { WebApp, WebAppInternals } from 'meteor/webapp';
import { Meteor } from 'meteor/meteor'

if (Meteor.isProduction) {
    import '/vite/vite-server/importBuild.cjs';
}

WebAppInternals.registerBoilerplateDataCallback('ssr-server', async (req, data) => {
    const pageContextInit = {
        urlOriginal: req.url.href
    }
    
    console.log('Received request:', { pageContextInit, data });
    
    const { httpResponse } = await renderPage(pageContextInit)
    
    const { body, statusCode, contentType, earlyHints } = httpResponse
    const { dynamicBody, dynamicHead } = body.match(/<head>(?<dynamicHead>[\s\S]+)<\/head>\s*<body>(?<dynamicBody>[\s\S]+)<\/body>/i)?.groups || {};
    
    data.dynamicBody = dynamicBody;
    data.dynamicHead = dynamicHead;
    
});