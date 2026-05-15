'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Appointment, AppointmentStatus } from "@/lib/types";
import { Calendar as CalendarIcon, Clock, Briefcase, Building, Plus, CalendarPlus, MoreHorizontal, CheckCircle, XCircle, Users, Check, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isSameDay } from "date-fns";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

interface UpcomingEventsProps {
    appointments: Appointment[];
    isLoading: boolean;
    onAddAppointment: () => void;
    onAddEvent: () => void;
    onUpdateStatus: (appointment: Appointment, status: AppointmentStatus) => void;
    onDelete: (appointment: Appointment) => void;
    onAddToCalendar: (event: any, appointment: Appointment) => void;
    onAllEventsClick: () => void;
    onViewDetails: (appointment: Appointment) => void;
}

export function UpcomingEvents({ 
    appointments, 
    isLoading, 
    onAddAppointment, 
    onAddEvent,
    onUpdateStatus,
    onDelete,
    onAddToCalendar,
    onAllEventsClick,
    onViewDetails,
}: UpcomingEventsProps) {
    const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
    
    const eventDates = useMemo(() => {
        return (appointments || [])
            .filter(a => a.status === 'Scheduled')
            .map(a => parseISO(a.date));
    }, [appointments]);

    const selectedDayEvents = useMemo(() => {
        if (!selectedDay) return [];
        return (appointments || [])
            .filter(a => isSameDay(parseISO(a.date), selectedDay))
            .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    }, [appointments, selectedDay]);

    if (isLoading) {
        return (
            <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-[280px] w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                </CardContent>
            </Card>
        )
    }

    const getIcon = (appt: Appointment) => {
        if (appt.contactType === 'Buyer') return <Briefcase className="h-4 w-4" />;
        if (appt.contactType === 'Owner' && appt.contactSerialNo) return <Building className="h-4 w-4" />;
        return <Users className="h-4 w-4" />;
    };

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary" /> Daily Planner
                            </CardTitle>
                            <CardDescription className="text-[10px] font-bold">Manage your appointments & tasks</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onSelect={() => onAddAppointment()}>
                                    <Briefcase className="mr-2 h-4 w-4" /> Add Appointment
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onAddEvent()}>
                                    <CalendarPlus className="mr-2 h-4 w-4" /> Custom Event
                                </DropdownMenuItem>
                                <Separator />
                                <DropdownMenuItem onSelect={() => onAllEventsClick()}>
                                    <CalendarIcon className="mr-2 h-4 w-4" /> View Full Calendar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col">
                        <div className="px-4 pb-2 border-b border-border/30">
                            <Calendar
                                mode="single"
                                selected={selectedDay}
                                onSelect={setSelectedDay}
                                className="p-0 rounded-md"
                                modifiers={{ hasEvent: eventDates }}
                                modifiersStyles={{
                                    hasEvent: { 
                                        fontWeight: 'bold', 
                                        textDecoration: 'underline',
                                        color: 'hsl(var(--primary))'
                                    }
                                }}
                            />
                        </div>

                        <div className="p-4 bg-muted/10 min-h-[200px]">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {selectedDay ? format(selectedDay, "MMM d, yyyy") : "Select a day"}
                                </h4>
                                <Badge variant="outline" className="text-[9px] font-bold">
                                    {selectedDayEvents.length} Tasks
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                {selectedDayEvents.length > 0 ? selectedDayEvents.map(appt => (
                                    <div 
                                        key={appt.id} 
                                        onClick={() => onViewDetails(appt)}
                                        className={cn(
                                            "group relative flex items-start gap-3 p-3 rounded-xl border border-border/40 transition-all cursor-pointer",
                                            appt.status === 'Completed' ? "bg-emerald-50/30 dark:bg-emerald-500/5 opacity-60" : "bg-background hover:shadow-md hover:border-primary/20"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center rounded-lg h-8 w-8 flex-shrink-0 transition-transform group-hover:scale-110",
                                            appt.contactType === 'Buyer' ? "bg-sky-100 dark:bg-sky-900/40 text-sky-600" : "bg-purple-100 dark:bg-purple-900/40 text-purple-600"
                                        )}>
                                            {getIcon(appt)}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={cn("text-xs font-bold truncate", appt.status === 'Completed' && "line-through")}>
                                                    {appt.contactName}
                                                </p>
                                                <span className="text-[9px] font-black font-mono text-primary flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5" /> {appt.time}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{appt.message}</p>
                                        </div>

                                        <div className="flex items-center gap-1 ml-2">
                                            {appt.status === 'Scheduled' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6 text-emerald-600 hover:bg-emerald-50"
                                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(appt, 'Completed'); }}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-background" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem onSelect={(e) => onAddToCalendar(e as any, appt)}>
                                                        <CalendarPlus className="mr-2 h-4 w-4" /> Sync Calendar
                                                    </DropdownMenuItem>
                                                    <Separator />
                                                    <DropdownMenuItem onSelect={() => onUpdateStatus(appt, 'Cancelled')} className="text-orange-600">
                                                        <XCircle className="mr-2 h-4 w-4" /> Mark Cancelled
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => onDelete(appt)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Task
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                                        <div className="p-3 bg-muted rounded-full mb-2">
                                            <CheckCircle className="h-6 w-6" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest">No Tasks Scheduled</p>
                                        <p className="text-[9px]">Enjoy your free time!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}