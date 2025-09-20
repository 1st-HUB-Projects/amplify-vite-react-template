import React, { useState, useMemo, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { generateClient } from 'aws-amplify/data';
import * as Recharts from 'recharts';
import type { Schema } from '../amplify/data/resource';
import { fetchUserAttributes } from 'aws-amplify/auth';

const client = generateClient<Schema>();

// --- Helper Functions & Static Components ---
const classNames = (...classes: (string | boolean)[]) => classes.filter(Boolean).join(' ');
const statusColors: Record<Schema['Order']['type']['status'], string> = {
    ORDERED: 'bg-blue-500', IN_PREPARATION: 'bg-yellow-500', PREPARED: 'bg-green-500',
    DELIVERED: 'bg-gray-500', CANCELLED: 'bg-red-500'
};

// --- Icon Components ---
const HomeIcon = ({ className }: { className: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const ClipboardListIcon = ({ className }: { className: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>;
const UsersIcon = ({ className }: { className: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;

// --- Main App Component ---
function App() {
    const { signOut, user } = useAuthenticator((context) => [context.user]);
    const [userRole, setUserRole] = useState<'BusinessOwner' | 'DeliveryAgent' | 'Unknown'>('Unknown');
    const [loadingRole, setLoadingRole] = useState(true);

    // This effect runs once to determine the user's role from their Cognito groups.
    useEffect(() => {
        const getGroups = async () => {
            try {
                const attributes = await fetchUserAttributes();
                const groups = attributes['cognito:groups'] || [];
                if (groups.includes('BusinessOwners')) {
                    setUserRole('BusinessOwner');
                } else if (groups.includes('DeliveryAgents')) {
                    setUserRole('DeliveryAgent');
                } else {
                    setUserRole('Unknown');
                }
            } catch (e) {
                console.error("Error fetching user groups:", e);
                setUserRole('Unknown');
            } finally {
                setLoadingRole(false);
            }
        };
        getGroups();
    }, []);

    if (loadingRole) {
        return <div className="bg-slate-900 text-white min-h-screen flex items-center justify-center"><h1>Checking permissions...</h1></div>;
    }

    // Render the correct UI based on the user's role.
    return (
        <div className="bg-slate-900 text-slate-200 min-h-screen font-sans">
            <header className="p-4 flex justify-between items-center bg-slate-800 border-b border-slate-700">
                <h1 className="text-xl font-bold">Cloud Kitchen</h1>
                <button onClick={signOut} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">Sign Out</button>
            </header>
            
            {userRole === 'BusinessOwner' && <BusinessOwnerDashboard />}
            {userRole === 'DeliveryAgent' && <DeliveryAgentDashboard agentId={user.userId} />}
            {userRole === 'Unknown' && <div className="p-8 text-center text-yellow-400"><h2>You do not have sufficient permissions to view this application. Please contact an administrator.</h2></div>}
        </div>
    );
}

// --- Role-Specific Dashboard Components ---

const BusinessOwnerDashboard = () => {
    // ... (This component contains the full UI with all views and modals)
    const [activeView, setActiveView] = useState('dashboard');
    const [modal, setModal] = useState<{ type: string, data?: any } | null>(null);

    const [orders, setOrders] = useState<Array<Schema["Order"]["type"]>>([]);
    const [customers, setCustomers] = useState<Array<Schema["Customer"]["type"]>>([]);
    const [deliveryAgents, setDeliveryAgents] = useState<Array<Schema["DeliveryAgent"]["type"]>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const MOCK_BUSINESS_ID = 'the-cloud-kitchen-123';

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const [ordersData, customersData, agentsData] = await Promise.all([
                    client.models.Order.list({ filter: { businessId: { eq: MOCK_BUSINESS_ID } } }),
                    client.models.Customer.list(),
                    client.models.DeliveryAgent.list()
                ]);
                setOrders(ordersData.data);
                setCustomers(customersData.data);
                setDeliveryAgents(agentsData.data);
            } catch (err) { setError("Failed to load business data."); console.error(err); } 
            finally { setLoading(false); }
        };
        fetchAllData();

        const subs = [
            client.models.Order.onCreate().subscribe({ next: (d) => setOrders(c => [d, ...c]) }),
            client.models.Order.onUpdate().subscribe({ next: (d) => setOrders(c => c.map(o => o.id === d.id ? d : o)) }),
            client.models.Order.onDelete().subscribe({ next: (d) => setOrders(c => c.filter(o => o.id !== d.id)) }),
        ];
        return () => subs.forEach(s => s.unsubscribe());
    }, [MOCK_BUSINESS_ID]);

    const handleAssignDelivery = async (agentId: string, selectedOrderIds: string[]) => {
        // ... (mutation logic remains the same)
        const updatePromises = selectedOrderIds.map(orderId => {
            const orderToUpdate = orders.find(o => o.orderId === orderId);
            if (!orderToUpdate) return null;
            return client.models.Order.update({
                businessId: orderToUpdate.businessId,
                orderId: orderToUpdate.orderId,
                deliveryAgentId: agentId, // Assigning the agent's ID
                status: 'IN_PREPARATION'
            });
        });
        try { await Promise.all(updatePromises.filter(p => p)); } 
        catch (err) { console.error("Error assigning orders:", err); }
        setModal(null);
    };

    if (loading) return <div className="p-8 text-center">Loading Business Data...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <DashboardView orders={orders} setModal={setModal} businessName="The Cloud Food & Beverage" />;
            case 'orders': return <OrdersView orders={orders} setModal={setModal} />;
            case 'customers': return <CustomersView customers={customers} />;
            default: return <DashboardView orders={orders} setModal={setModal} businessName="The Cloud Food & Beverage" />;
        }
    };
    
    const renderModal = () => {
        if (!modal) return null;
        if (modal.type === 'orderDetail') return <OrderDetailModal order={modal.data.order} onClose={() => setModal(null)} />;
        if (modal.type === 'assignDelivery') return <AssignDeliveryModal orders={orders} deliveryAgents={deliveryAgents} onAssign={handleAssignDelivery} onClose={() => setModal(null)} />;
        return null;
    };

    return (
        <div className="pb-20">
            {renderModal()}
            <main>{renderView()}</main>
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex justify-around">
                <button onClick={() => setActiveView('dashboard')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'dashboard' ? 'text-sky-400' : 'text-slate-400')}><HomeIcon className="h-6 w-6 mb-1" /> <span className="text-xs">Dashboard</span></button>
                <button onClick={() => setActiveView('orders')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'orders' ? 'text-sky-400' : 'text-slate-400')}><ClipboardListIcon className="h-6 w-6 mb-1" /><span className="text-xs">Orders</span></button>
                <button onClick={() => setActiveView('customers')} className={classNames('flex-1 flex flex-col items-center justify-center py-2', activeView === 'customers' ? 'text-sky-400' : 'text-slate-400')}><UsersIcon className="h-6 w-6 mb-1" /><span className="text-xs">Customers</span></button>
            </nav>
        </div>
    );
};

const DeliveryAgentDashboard = ({ agentId }: { agentId: string }) => {
    const [assignedOrders, setAssignedOrders] = useState<Array<Schema["Order"]["type"]>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // This is the secure, conditional query. It will only return orders where
        // `deliveryAgentId` matches the currently logged-in user's ID.
        const subscription = client.models.Order.ordersByDeliveryAgent({
            deliveryAgentId: agentId
        }).observeQuery();
        
        const sub = subscription.subscribe({
            next: ({ items }) => {
                setAssignedOrders(items);
                setLoading(false);
            },
            error: (err) => {
                setError("Could not fetch assigned orders.");
                setLoading(false);
                console.error(err);
            }
        });

        return () => sub.unsubscribe();
    }, [agentId]);

    const handleMarkDelivered = async (order: Schema['Order']['type']) => {
        try {
            await client.models.Order.update({
                businessId: order.businessId,
                orderId: order.orderId,
                status: 'DELIVERED'
            });
        } catch (e) {
            console.error("Failed to mark order as delivered:", e);
            alert("Update failed. You may not have permission.");
        }
    };

    if (loading) return <div className="p-8 text-center">Loading Assigned Orders...</div>;
    if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-white mb-4">My Deliveries</h2>
            <div className="space-y-3">
                {assignedOrders.length === 0 && <p className="text-slate-400">You have no orders assigned.</p>}
                {assignedOrders.filter(o => o.status !== 'DELIVERED').map(order => (
                    <div key={order.orderId} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{order.orderId}</p>
                            <p className="text-sm text-slate-400">{order.customerPhone}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className={classNames(statusColors[order.status!], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white')}>{order.status}</span>
                             <button 
                                onClick={() => handleMarkDelivered(order)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md text-sm"
                             >
                                Mark Delivered
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- UI Sub-Components (Dashboard, Orders, Customers, Modals) ---
// These are the same as before, just with TypeScript props for type safety.
// I've included them here for a complete, single-file solution.

interface DashboardViewProps { orders: Schema['Order']['type'][]; setModal: (modal: any) => void; businessName: string; }
const DashboardView = ({ orders, setModal, businessName }: DashboardViewProps) => {
    // ... (Component implementation is identical to the previous fully-functional version)
    const today = new Date().toISOString().slice(0, 10);
    const todaysOrders = useMemo(() => orders.filter(o => o.orderDate?.startsWith(today)), [orders, today]);
    const kpis = useMemo(() => ({
        totalOrders: todaysOrders.length,
        revenueToday: todaysOrders.reduce((acc, o) => o.status === 'DELIVERED' ? acc + o.amount : acc, 0),
        inProgress: todaysOrders.filter(o => o.status === 'IN_PREPARATION').length,
        readyForDelivery: todaysOrders.filter(o => o.status === 'PREPARED').length,
    }), [todaysOrders]);
    const chartData = useMemo(() => {
        const statusCounts = todaysOrders.reduce((acc, o) => {
            acc[o.status!] = (acc[o.status!] || 0) + 1; return acc;
        }, {} as Record<string, number>);
        return Object.entries(statusCounts).map(([name, value]) => ({ name, orders: value }));
    }, [todaysOrders]);
    return (
        <div className="p-4 space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-white">Good Morning, {businessName}</h2>
                <p className="text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Total Orders</p><p className="text-3xl font-bold text-white">{kpis.totalOrders}</p></div>
                <div className="bg-slate-800 p-4 rounded-lg shadow-md text-center"><p className="text-slate-400 text-sm">Revenue Today</p><p className="text-3xl font-bold text-white">${kpis.revenueToday.toFixed(2)}</p></div>
                <div className="bg-yellow-800/50 p-4 rounded-lg shadow-md text-center"><p className="text-yellow-300 text-sm">In Progress</p><p className="text-3xl font-bold text-white">{kpis.inProgress}</p></div>
                <button onClick={() => setModal({ type: 'assignDelivery' })} className="bg-green-800/50 p-4 rounded-lg shadow-md text-center transition hover:bg-green-700/50 disabled:opacity-50" disabled={kpis.readyForDelivery === 0}>
                    <p className="text-green-300 text-sm">Ready for Delivery</p>
                    <p className="text-3xl font-bold text-white">{kpis.readyForDelivery}</p>
                </button>
            </div>
            <div className="bg-slate-800 p-4 rounded-lg shadow-md">
                 <h3 className="text-lg font-semibold text-white mb-4">Today's Order Status</h3>
                 <div style={{ width: '100%', height: 300 }}>
                    <Recharts.ResponsiveContainer>
                        <Recharts.BarChart data={chartData}>
                            <Recharts.XAxis dataKey="name" stroke="#94a3b8" />
                            <Recharts.YAxis stroke="#94a3b8" />
                            <Recharts.Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                            <Recharts.Bar dataKey="orders" fill="#38bdf8" />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                 </div>
            </div>
        </div>
    );
};

interface OrdersViewProps { orders: Schema['Order']['type'][]; setModal: (modal: any) => void; }
const OrdersView = ({ orders, setModal }: OrdersViewProps) => {
    const [filter, setFilter] = useState('active');
    const filteredOrders = useMemo(() => {
        if (filter === 'active') return orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
        if (filter === 'all') return [...orders].sort((a, b) => new Date(b.orderDate!).getTime() - new Date(a.orderDate!).getTime());
        return orders.filter(o => o.status === filter.toUpperCase());
    }, [orders, filter]);
    return (
         <div className="p-4">
            <h2 className="text-2xl font-bold text-white mb-4">Order Management</h2>
            <div className="flex space-x-2 mb-4">
                <button onClick={() => setFilter('active')} className={classNames(filter === 'active' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Active</button>
                <button onClick={() => setFilter('prepared')} className={classNames(filter === 'prepared' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>Prepared</button>
                <button onClick={() => setFilter('all')} className={classNames(filter === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-700', 'px-3 py-1 text-sm rounded-full')}>All Orders</button>
            </div>
            <div className="space-y-3">
                {filteredOrders.map(order => (
                    <div key={order.orderId} onClick={() => setModal({ type: 'orderDetail', data: { order } })} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center cursor-pointer transition hover:bg-slate-700">
                        <div>
                            <p className="font-bold text-white">{order.orderId}</p>
                            <p className="text-sm text-slate-400">{order.customerPhone}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-white">${order.amount.toFixed(2)}</p>
                            <span className={classNames(statusColors[order.status!], 'text-xs font-semibold px-2 py-0.5 rounded-full text-white')}>{order.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface CustomersViewProps { customers: Schema['Customer']['type'][]; }
const CustomersView = ({ customers }: CustomersViewProps) => {
     return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-white mb-4">Customers</h2>
            <div className="space-y-3">
                {customers.map(customer => (
                    <div key={customer.customerPhone} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-bold text-white">{customer.customerName}</p>
                            <p className="text-sm text-slate-400">{customer.customerPhone}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface OrderDetailModalProps { order: Schema['Order']['type']; onClose: () => void; }
const OrderDetailModal = ({ order, onClose }: OrderDetailModalProps) => {
    const lineItems = useMemo(() => {
        try {
            const items = JSON.parse(order.lineItems as string);
            return Array.isArray(items) ? items : [];
        } catch (e) { return []; }
    }, [order.lineItems]);
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
             <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">{order.orderId} Details</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <h4 className="font-semibold text-white">Line Items</h4>
                        <ul className="space-y-1 mt-1 text-slate-300">
                            {lineItems.map((item: { quantity: number; item: string; price: number }, index: number) => (
                                <li key={index} className="flex justify-between text-sm">
                                    <span>{item.quantity} x {item.item}</span>
                                    <span>${item.price.toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                     <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-white">
                        <span>Total Amount</span>
                        <span>${order.amount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AssignDeliveryModalProps {
    orders: Schema['Order']['type'][]; deliveryAgents: Schema['DeliveryAgent']['type'][];
    onAssign: (agentId: string, orderIds: string[]) => void; onClose: () => void;
}
const AssignDeliveryModal = ({ orders, deliveryAgents, onAssign, onClose }: AssignDeliveryModalProps) => {
    const [selectedAgent, setSelectedAgent] = useState(deliveryAgents[0]?.agentId || '');
    const preparedOrders = useMemo(() => orders.filter(o => o.status === 'PREPARED'), [orders]);
    const [selectedOrders, setSelectedOrders] = useState(() => preparedOrders.map(o => o.orderId));
    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
    };
    return (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg w-full max-w-md shadow-xl">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Assign Delivery</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label htmlFor="agent" className="block text-sm font-medium text-slate-300 mb-1">Select Delivery Agent</label>
                        <select id="agent" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="w-full bg-slate-700 text-white rounded-md p-2 border border-slate-600 focus:ring-sky-500 focus:border-sky-500">
                           {deliveryAgents.map(agent => <option key={agent.agentId} value={agent.agentId}>{agent.agentName}</option>)}
                        </select>
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">Select Orders to Assign</h4>
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                           {preparedOrders.map(order => (
                                <div key={order.orderId} className="flex items-center bg-slate-700 p-2 rounded-md">
                                    <input type="checkbox" id={order.orderId} checked={selectedOrders.includes(order.orderId)} onChange={() => toggleOrderSelection(order.orderId)} className="h-4 w-4 rounded border-slate-500 text-sky-600 focus:ring-sky-500"/>
                                    <label htmlFor={order.orderId} className="ml-3 text-sm text-slate-200">{order.orderId} ({JSON.parse(order.lineItems as string)?.length || 0} items)</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-b-lg flex justify-end">
                    <button onClick={() => onAssign(selectedAgent, selectedOrders)} className="bg-sky-600 text-white font-bold py-2 px-4 rounded-md hover:bg-sky-700 disabled:opacity-50" disabled={!selectedAgent || selectedOrders.length === 0}>
                        Assign {selectedOrders.length} Orders
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
