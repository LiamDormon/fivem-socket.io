-- Example of how to use the socket.io wrapper from a Lua script

-- Connect to a socket server
local connected = exports['fivem-socket.io']:socketConnect('http://localhost:3000', '/')
if connected then
    print('Connected to socket server')
    
    -- Subscribe to an event
    -- The second parameter is the callback event name that will be triggered when the event is received
    exports['fivem-socket.io']:socketSubscribe('http://localhost:3000', '/', 'server-event', 'client:socket:data')
    
    -- Listen for the callback event
    RegisterNetEvent('client:socket:data')
    AddEventHandler('client:socket:data', function(data)
        print('Received data from socket server:')
        print(json.encode(data))
    end)
    
    -- Publish an event to the socket server
    exports['fivem-socket.io']:socketPublish('http://localhost:3000', '/', 'client-event', {message = 'Hello from FiveM!'})
    
    -- Later, when you're done with the socket
    -- exports['fivem-socket.io']:socketUnsubscribe('http://localhost:3000', '/', 'server-event')
    -- exports['fivem-socket.io']:socketDisconnect('http://localhost:3000', '/')
else
    print('Failed to connect to socket server')
end

-- Alternatively, you can use events
-- These can be triggered from any resource
TriggerEvent('socket:connect', 'http://localhost:3000', '/')

-- Listen for the connected event
RegisterNetEvent('socket:connected')
AddEventHandler('socket:connected', function(url, namespace, success)
    if success then
        print('Connected to ' .. url .. namespace)
        
        -- Subscribe to an event
        TriggerEvent('socket:subscribe', url, namespace, 'server-event', 'client:socket:data')
        
        -- Publish an event
        TriggerEvent('socket:publish', url, namespace, 'client-event', {message = 'Hello from FiveM!'})
    else
        print('Failed to connect to ' .. url .. namespace)
    end
end)

-- When your resource stops, remember to clean up
AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    
    -- Disconnect from all sockets
    exports['fivem-socket.io']:socketDisconnectAll()
end)
