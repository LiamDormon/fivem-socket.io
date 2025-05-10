# FiveM Socket.io Wrapper

A FiveM resource that serves as a wrapper around the Socket.io library, allowing you to connect to arbitrary Socket.io servers, subscribe to events, and publish data from your FiveM server.

## Installation

1. Clone this repository into your FiveM resources folder
2. Add `ensure fivem-socket.io` to your server.cfg
3. Build the resource with:
   ```bash
   pnpm install
   pnpm build
   ```

## Usage

### Basic Usage

```lua
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
    exports['fivem-socket.io']:socketUnsubscribe('http://localhost:3000', '/', 'server-event')
    exports['fivem-socket.io']:socketDisconnect('http://localhost:3000', '/')
end
```

### Using Headers and URL Parameters

```lua
-- Create connection options with headers and params
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
    -- Subscribe to an event with the same options
    exports['fivem-socket.io']:socketSubscribe(
        'http://localhost:3000', 
        '/', 
        'server-event', 
        'client:socket:data',
        options
    )
    
    -- Publish an event with options
    exports['fivem-socket.io']:socketPublish(
        'http://localhost:3000', 
        '/', 
        'client-event', 
        {message = 'Hello from FiveM!'}, 
        options
    )
end
```

```lua
-- Example of a comprehensive options object
local options = {
    -- Connection options
    reconnectionAttempts = 5,
    reconnectionDelay = 2000,
    timeout = 10000,
    autoConnect = true,
    
    -- Custom headers for authentication
    headers = {
        Authorization = "Bearer token123",
        ["x-api-key"] = "your-api-key",
        ["Content-Type"] = "application/json",
        ["User-Agent"] = "FiveM-Socket.io-Client"
    },
    
    -- URL parameters to send with the connection
    params = {
        userId = "123456",
        clientVersion = "1.0.0",
        serverRegion = "us-west",
        debug = true
    }
}

-- The headers and params will be included in the socket connection
local result = exports['fivem-socket.io']:socketConnect('http://localhost:3000', '/', options)

-- They will also be included in subscribe operations
exports['fivem-socket.io']:socketSubscribe('http://localhost:3000', '/', 'user-updates', 'client:user:update', options)

-- And in publish operations
exports['fivem-socket.io']:socketPublish('http://localhost:3000', '/', 'client-action', { action = "login" }, options)
```

See the `examples` folder for more detailed usage examples.

## Available Exports

These exports can be called from both server and client-side Lua scripts:

- `socketConnect(url, namespace, options)` - Connect to a socket server
- `socketSubscribe(url, namespace, event, callbackEvent)` - Subscribe to an event
- `socketUnsubscribe(url, namespace, event)` - Unsubscribe from an event
- `socketPublish(url, namespace, event, data)` - Publish an event
- `socketDisconnect(url, namespace)` - Disconnect from a socket
- `socketDisconnectAll()` - Disconnect from all sockets

## Available Events

These events can be triggered from both server and client-side Lua scripts:

- `socket:connect` - Connect to a socket server
- `socket:subscribe` - Subscribe to an event
- `socket:unsubscribe` - Unsubscribe from an event
- `socket:publish` - Publish an event
- `socket:disconnect` - Disconnect from a socket
- `socket:disconnectAll` - Disconnect from all sockets

## Architecture

This library is structured with the following components:

- **SocketManager**: Core class handling Socket.io connections and interactions
- **FiveMSocketAdapter**: Adapter that exposes functionality through FiveM exports and events
- **Validation Module**: Separate validation utilities for input sanitisation and validation
  - `validators.ts`: Contains URL, namespace, event, and options validation
  - `sanitisers.ts`: Contains data sanitisation functions
  - `index.ts`: Exports all validation utilities
