
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/firebase/provider';
import { collection, query, where, doc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { useUser } from '@/firebase/auth/use-user';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import type { Notification, InvitationNotification, AppointmentNotification, Activity, ActivityNotification, Appointment, UserRole, Buyer, Property, MessageNotification } from '@/lib/types';
import { isBefore, sub } from 'date-fns';
import { useCollection } from '@/firebase/firestore/use-collection';

const NOTIFICATION_READ_STATUS_KEY = 'signaturecrm_read_notifications';
const DELETED_NOTIFICATIONS_KEY = 'signaturecrm_deleted_notifications';

export const useNotifications = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const { profile } = useProfile();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const forceRefresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    const canFetch = !!firestore && !!user;
    const canFetchAgencyData = canFetch && !!profile.agency_id;
    
    // 1. Invitations (App-wide lookup by email)
    const invitationsQuery = useMemoFirebase(() => {
        return (firestore && user?.email) ? query(collection(firestore, 'invitations'), where('toEmail', '==', user.email), where('status', 'in', ['pending', 'Pending'])) : null;
    }, [firestore, user?.email, refreshKey]);
    const { data: invitationsData, isLoading: isInvitesLoading } = useCollection<any>(invitationsQuery);
    
    // 2. Appointments (Specific to current user)
    const appointmentsQuery = useMemoFirebase(() => canFetchAgencyData ? query(collection(firestore, 'agencies', profile.agency_id, 'appointments'), where('agentName', '==', profile.name)) : null, [canFetchAgencyData, firestore, profile.agency_id, profile.name, refreshKey]);
    const { data: appointmentsData, isLoading: isAppointmentsLoading } = useCollection<Appointment>(appointmentsQuery);

    // 3. Activities (Recent logs)
    const activitiesQuery = useMemoFirebase(() => {
        if(!canFetchAgencyData) return null;
        const oneDayAgo = sub(new Date(), { days: 1 });
        return query(
            collection(firestore, 'agencies', profile.agency_id, 'activityLogs'),
            where('timestamp', '>=', oneDayAgo.toISOString()),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
    }, [canFetchAgencyData, firestore, profile.agency_id, refreshKey]);
    const { data: activitiesData, isLoading: isActivitiesLoading } = useCollection<Activity>(activitiesQuery);

    // 4. Messages (Unread checks)
    const buyersQuery = useMemoFirebase(() => canFetchAgencyData ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [canFetchAgencyData, firestore, profile.agency_id]);
    const { data: buyersData } = useCollection<Buyer>(buyersQuery);
    const propertiesQuery = useMemoFirebase(() => canFetchAgencyData ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [canFetchAgencyData, firestore, profile.agency_id]);
    const { data: propertiesData } = useCollection<Property>(propertiesQuery);


    const getStoredIds = (key: string): string[] => {
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    };
    const setStoredIds = (key: string, ids: string[]) => localStorage.setItem(key, JSON.stringify(ids));

    useEffect(() => {
        if (isInvitesLoading || isAppointmentsLoading || isActivitiesLoading) {
            setIsLoading(true);
            return;
        }

        const readIds = getStoredIds(NOTIFICATION_READ_STATUS_KEY);
        const deletedIds = getStoredIds(DELETED_NOTIFICATIONS_KEY);
        let allNotifications: Notification[] = [];

        // Invitations
        if(invitationsData) {
             const invites: InvitationNotification[] = invitationsData.map(doc => ({
                id: doc.id,
                type: 'invitation',
                title: `Invitation from ${doc.fromAgencyName}`,
                description: `You have been invited to join as a ${doc.role}.`,
                timestamp: doc.invitedAt?.toDate() || new Date(),
                isRead: readIds.includes(doc.id),
                fromAgencyId: doc.fromAgencyId,
                fromAgencyName: doc.fromAgencyName,
                role: doc.role as UserRole,
                email: doc.toEmail,
                memberDocId: doc.memberDocId 
            }));
            allNotifications.push(...invites);
        }

        // Appointments
        if(appointmentsData) {
            const now = new Date();
            const upcomingAppointments = appointmentsData
                .filter(appt => appt.status === 'Scheduled' && isBefore(now, new Date(`${appt.date}T${appt.time}`)))
                .map(appt => ({
                    id: `appt_${appt.id}`,
                    type: 'appointment',
                    title: `Upcoming: ${appt.contactName}`,
                    description: `At ${appt.time} on ${appt.date}.`,
                    timestamp: new Date(`${appt.date}T${appt.time}`),
                    isRead: readIds.includes(`appt_${appt.id}`),
                    appointment: appt,
                    reminderType: 'day'
                } as AppointmentNotification));
            allNotifications.push(...upcomingAppointments);
        }
        
        // Activities
        if (activitiesData) {
            const activityNotifications: ActivityNotification[] = activitiesData
                 .filter(act => 
                    (act.action.includes('updated') && act.userName !== profile.name) ||
                    (act.targetType === 'Invitation' && profile.role === 'Admin') ||
                    (act.action.includes('assigned') && act.assignedToId === user?.uid)
                )
                .map(act => ({
                    id: `act_${act.id}`,
                    type: 'activity',
                    title: act.action.includes('assigned') ? 'New Lead Assigned' : 'Status Update',
                    description: `${act.userName}: ${act.action} ${act.target}`,
                    timestamp: new Date(act.timestamp),
                    isRead: readIds.includes(`act_${act.id}`),
                    activity: act
                } as ActivityNotification));
            allNotifications.push(...activityNotifications);
        }

        // Message unread notifications
        const unreadBuyers = buyersData?.filter(b => b.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id))) || [];
        const unreadProps = propertiesData?.filter(p => p.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id))) || [];

        const messageNotifications: MessageNotification[] = [...unreadBuyers, ...unreadProps].map(lead => {
            const isBuyer = lead.serial_no.startsWith('B') || lead.serial_no.startsWith('RB');
            const lastMsg = lead.timeline_notes![lead.timeline_notes!.length - 1];
            return {
                id: `msg_${lead.id}`,
                type: 'message',
                title: `New Remark: ${lead.serial_no}`,
                description: `${lastMsg.authorName}: ${lastMsg.text.substring(0, 30)}${lastMsg.text.length > 30 ? '...' : ''}`,
                timestamp: new Date(lastMsg.timestamp),
                isRead: false,
                leadId: lead.id,
                leadSerial: lead.serial_no,
                authorName: lastMsg.authorName,
                leadType: isBuyer ? 'Buyer' : 'Property'
            };
        });
        allNotifications.push(...messageNotifications);

        allNotifications = allNotifications
            .filter(n => !deletedIds.includes(n.id))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        setNotifications(allNotifications);
        setIsLoading(false);

    }, [invitationsData, appointmentsData, activitiesData, buyersData, propertiesData, isInvitesLoading, isAppointmentsLoading, isActivitiesLoading, profile.name, profile.role, user?.uid, profile.user_id, refreshKey]);

    const markAsRead = async (id: string) => {
        if (id.startsWith('msg_')) {
            const leadId = id.replace('msg_', '');
            const buyer = buyersData?.find(b => b.id === leadId);
            const prop = propertiesData?.find(p => p.id === leadId);
            const lead = buyer || prop;
            const collectionName = buyer ? 'buyers' : 'properties';

            if (lead && lead.timeline_notes && profile.agency_id) {
                const updatedNotes = lead.timeline_notes.map(n => ({
                    ...n,
                    readBy: Array.from(new Set([...(n.readBy || []), profile.user_id]))
                }));
                const leadRef = doc(firestore, 'agencies', profile.agency_id, collectionName, lead.id);
                await updateDoc(leadRef, { timeline_notes: updatedNotes });
            }
        }
        
        const readIds = getStoredIds(NOTIFICATION_READ_STATUS_KEY);
        if (!readIds.includes(id)) {
            const newReadIds = [...readIds, id];
            setStoredIds(NOTIFICATION_READ_STATUS_KEY, newReadIds);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        }
    };
    
    const markAllAsRead = async () => {
        // Mark messages in Firestore
        if (profile.agency_id) {
            const unreadLeads = [
                ...(buyersData?.filter(b => b.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id))) || []),
                ...(propertiesData?.filter(p => p.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id))) || [])
            ];
            
            for (const lead of unreadLeads) {
                const isBuyer = lead.serial_no.startsWith('B') || lead.serial_no.startsWith('RB');
                const updatedNotes = lead.timeline_notes!.map(n => ({
                    ...n,
                    readBy: Array.from(new Set([...(n.readBy || []), profile.user_id]))
                }));
                const leadRef = doc(firestore, 'agencies', profile.agency_id, isBuyer ? 'buyers' : 'properties', lead.id);
                await updateDoc(leadRef, { timeline_notes: updatedNotes });
            }
        }

        const currentIds = notifications.map(n => n.id);
        setStoredIds(NOTIFICATION_READ_STATUS_KEY, currentIds);
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    };
    
    const deleteNotification = (notificationId: string) => {
        const deletedIds = getStoredIds(DELETED_NOTIFICATIONS_KEY);
        if (!deletedIds.includes(notificationId)) {
            setStoredIds(DELETED_NOTIFICATIONS_KEY, [...deletedIds, notificationId]);
        }
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };
    
    const acceptInvitation = async (invitationId: string, agencyId: string, userId: string) => {
        const batch = writeBatch(firestore);
        
        const invitationData = notifications.find(n => n.id === invitationId) as InvitationNotification;
        if (!invitationData) throw new Error("Invitation not found");
        
        // 1. Update agency's member record
        const memberRef = doc(firestore, 'agencies', agencyId, 'teamMembers', invitationData.memberDocId);
        batch.update(memberRef, {
             status: 'Active',
             user_id: userId,
             joinedAt: new Date().toISOString()
        });
        
        // 2. Update user's profile
        const userRef = doc(firestore, 'users', userId);
        batch.set(userRef, { 
            agency_id: agencyId,
            role: invitationData.role,
            agencyName: invitationData.fromAgencyName
        }, { merge: true });

        // 3. Delete invitation
        const invRef = doc(firestore, 'invitations', invitationId);
        batch.delete(invRef);
        
        // 4. Log activity
        const activityLogRef = doc(collection(firestore, 'agencies', agencyId, 'activityLogs'));
        batch.set(activityLogRef, {
            userName: profile.name,
            action: `joined the agency by accepting invitation.`,
            target: invitationData.fromAgencyName,
            targetType: 'Invitation',
            timestamp: new Date().toISOString(),
            agency_id: agencyId
        });
        
        await batch.commit();
        deleteNotification(invitationId);
        window.location.reload(); 
    };

    const rejectInvitation = async (invitationId: string, agencyId: string) => {
        const invitationData = notifications.find(n => n.id === invitationId) as InvitationNotification;
        if (!invitationData) return;

        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'invitations', invitationId));

        if (invitationData.memberDocId) {
            batch.delete(doc(firestore, 'agencies', agencyId, 'teamMembers', invitationData.memberDocId));
        }
        
        await batch.commit();
        deleteNotification(invitationId);
    };

    return { notifications, isLoading, acceptInvitation, rejectInvitation, markAsRead, markAllAsRead, deleteNotification, forceRefresh };
};
