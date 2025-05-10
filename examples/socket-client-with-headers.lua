-- Example of how to use the socket.io wrapper with headers and params from a Lua script

-- Connection options with headers and params
local options = {
    -- Connection options
    reconnectionAttempts = 5,
    reconnectionDelay = 2000,
    timeout = 10000,
    autoConnect = true,
    
    -- Custom headers for authentication
    headers = {
        Authorization = "Bearer token123",
        ["x-api-key"] = "your-api-key"
    },
    
    -- URL parameters to send with the connection
    params = {
        userId = "123456",
        clientVersion = "1.0.0"
    }
}

-- Connect to a socket server with options
local connected = exports['fivem-socket.io']:socketConnect('http://localhost:3000', '/', options)
if connected then
    print('Connected to socket server with custom headers and params')
    
    -- Subscribe to an event with options
    exports['fivem-socket.io']:socketSubscribe('http://localhost:3000', '/', 'server-event', 'client:socket:data', options)
    
    -- Listen for the callback event
    RegisterNetEvent('client:socket:data')
    AddEventHandler('client:socket:data', function(data)
        print('Received data from socket server:')
        print(json.encode(data))
    end)
    
    -- Publish an event to the socket server with options
    exports['fivem-socket.io']:socketPublish('http://localhost:3000', '/', 'client-event', {message = 'Hello from FiveM!'}, options)
    
    -- Later, when you're done with the socket
    -- exports['fivem-socket.io']:socketUnsubscribe('http://localhost:3000', '/', 'server-event', options)
    -- exports['fivem-socket.io']:socketDisconnect('http://localhost:3000', '/')
else
    print('Failed to connect to socket server')
end

-- Alternatively, you can use events with options
local eventOptions = {
    headers = {
        Authorization = "Bearer eventToken",
        ["x-custom-header"] = "custom-value" 
    },
    params = {
        source = "event-system"
    }
}

-- These can be triggered from any resource
TriggerEvent('socket:connect', 'http://localhost:3000', '/', eventOptions)

-- Listen for the connected event
RegisterNetEvent('socket:connected')
AddEventHandler('socket:connected', function(url, namespace, success)
    if success then
        print('Connected to ' .. url .. namespace)
        
        -- Subscribe to an event with options
        TriggerEvent('socket:subscribe', url, namespace, 'server-event', 'client:socket:data', eventOptions)
        
        -- Publish an event with options
        TriggerEvent('socket:publish', url, namespace, 'client-event', {message = 'Hello from FiveM!'}, eventOptions)
    else
        print('Failed to connect to ' .. url .. namespace)
    end
end)

-- When your resource stops, remember to clean up
AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    exports['fivem-socket.io']:socketDisconnectAll()
end)
