import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

// --- Enums for Statuses ---
const OrderStatus = a.enum([
  'ORDERED',
  'IN_PREPARATION',
  'PREPARED',
  'DELIVERED',
  'CANCELLED'
]);

// --- Main Schema Definition ---
const schema = a.schema({
  
  // --- Order Model ---
  Order: a
    .model({
      businessId: a.string().required(), 
      orderId: a.string().required(),
      customerPhone: a.string().required(),
      orderDate: a.datetime().required(),
      amount: a.float().required(),
      status: a.enum(OrderStatus).required(),
      lineItems: a.json().required(),
      // This field is now critical for authorization. It will store the agent's user ID (sub).
      deliveryAgentId: a.string(), 
    })
    .identifier(['businessId', 'orderId'])
    .secondaryIndexes(index => [
      index('customerPhone').sortKeys(['orderDate']).queryField('ordersByCustomer'),
      index('status').sortKeys(['orderDate']).queryField('ordersByStatus'),
      // This index is now used by agents to fetch their assigned orders.
      index('deliveryAgentId').sortKeys(['orderDate']).queryField('ordersByDeliveryAgent')
    ])
    // --- MULTI-LEVEL AUTHORIZATION RULES ---
    .authorization(allow => [
      // Rule 1: Highest privilege for Business Owners
      allow.groups(['BusinessOwners']).to(['create', 'read', 'update', 'delete']),
      
      // Rule 2: Conditional privilege for Delivery Agents
      allow.groups(['DeliveryAgents'])
        .to(['read', 'update'])
        .where({
          // This "where" clause is the key: it enforces that the agent's ID
          // must match the ID on the order record.
          deliveryAgentId: { eq: a.user().id } 
        }),

      // Rule 3: Lowest privilege for any other authenticated user (e.g., the AI Agent)
      allow.authenticated().to(['create']),
    ]),

  // --- Customer Model ---
  Customer: a
    .model({
      customerPhone: a.string().required(),
      customerName: a.string().required(),
    })
    .identifier(['customerPhone'])
    .authorization(allow => [
      allow.groups(['BusinessOwners']).to(['read', 'create', 'update', 'delete'])
    ]),

  // --- DeliveryAgent Model ---
  DeliveryAgent: a
    .model({
      // The agent's user ID (from Cognito) is their unique identifier.
      agentId: a.string().required(),
      agentName: a.string().required(),
    })
    .identifier(['agentId'])
    .authorization(allow => [
      // Business Owners manage the list of who is an agent.
      allow.groups(['BusinessOwners']).to(['read', 'create', 'update', 'delete']),
      // Agents can read their own entry in the agent list.
      allow.groups(['DeliveryAgents']).to(['read']).where({ agentId: { eq: a.user().id } })
    ]),
});

// --- Export the schema and define authorization modes ---
export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
