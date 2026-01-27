"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  Calendar,
  MapPin,
  Users,
  Edit,
  ToggleLeft,
  ToggleRight,
  CalendarIcon,
  Ticket,
  QrCode,
  Search,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Event, EventPass } from "@/types";

const eventFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startsAt: z.date({ required_error: "Please select a date" }),
  startsAtTime: z.string({ required_error: "Please select a time" }),
  venue: z.string().min(2, "Venue is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1").optional(),
  pricePaise: z.coerce.number().min(0, "Price must be 0 or more"),
});

type EventFormData = z.infer<typeof eventFormSchema>;

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminEventsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEventForPasses, setSelectedEventForPasses] = useState<Event | null>(null);
  const [passSearch, setPassSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: () => adminApi.listEvents(),
  });

  const { data: passesData, isLoading: passesLoading } = useQuery({
    queryKey: ["admin", "passes", selectedEventForPasses?.id],
    queryFn: () => adminApi.listPasses(selectedEventForPasses?.id),
    enabled: !!selectedEventForPasses,
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      venue: "",
      pricePaise: 200, // ₹200
      startsAtTime: "18:00",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<Event, "id" | "createdAt" | "updatedAt">) =>
      adminApi.createEvent(data),
    onSuccess: () => {
      toast({ title: "Event created successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Event> }) =>
      adminApi.updateEvent(id, data),
    onSuccess: () => {
      toast({ title: "Event updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
      setIsDialogOpen(false);
      setEditingEvent(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update event", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.updateEvent(id, { active }),
    onSuccess: () => {
      toast({ title: "Event status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: ({ passId }: { passId: string }) =>
      adminApi.checkinPass({ passId, adminEmail: "admin@ossspace.com" }),
    onSuccess: () => {
      toast({ title: "Pass checked in successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "passes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Check-in failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: EventFormData) => {
    const [hours, minutes] = data.startsAtTime.split(":").map(Number);
    const startsAt = new Date(data.startsAt);
    startsAt.setHours(hours, minutes, 0, 0);

    const eventData = {
      title: data.title,
      description: data.description || null,
      startsAt: startsAt.toISOString(),
      venue: data.venue,
      capacity: data.capacity || null,
      pricePaise: data.pricePaise * 100,
      active: true,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: eventData });
    } else {
      createMutation.mutate(eventData as any);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    const startsAt = new Date(event.startsAt);
    form.reset({
      title: event.title,
      description: event.description || "",
      startsAt: startsAt,
      startsAtTime: `${startsAt.getHours().toString().padStart(2, "0")}:${startsAt.getMinutes().toString().padStart(2, "0")}`,
      venue: event.venue,
      capacity: event.capacity || undefined,
      pricePaise: event.pricePaise / 100,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    form.reset();
  };

  const events: any[] = data?.data || [];
  const passes: any[] = passesData?.data || [];
  const filteredPasses = passes.filter((pass: any) =>
    passSearch
      ? pass.passId.toLowerCase().includes(passSearch.toLowerCase()) ||
        pass.booking?.customerName?.toLowerCase().includes(passSearch.toLowerCase())
      : true
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground">
            Manage events and check-in attendees
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingEvent(null); form.reset(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
              <DialogDescription>
                {editingEvent ? "Update event details" : "Create a new event"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Open Mic Night" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the event..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="venue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <FormControl>
                        <Input placeholder="OSS Main Hall" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startsAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : "Pick date"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startsAtTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" placeholder="100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricePaise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingEvent ? (
                      "Update Event"
                    ) : (
                      "Create Event"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
        </TabsList>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="text-center py-16 text-destructive">
                  Failed to load events. Please try again.
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No events found. Create your first event!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Passes</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDateTime(event.startsAt)}
                        </TableCell>
                        <TableCell>{event.venue}</TableCell>
                        <TableCell>
                          {event.passesIssued || 0}
                          {event.capacity && `/${event.capacity}`}
                        </TableCell>
                        <TableCell>{formatPrice(event.pricePaise)}</TableCell>
                        <TableCell>
                          <Badge variant={event.active ? "default" : "secondary"}>
                            {event.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEventForPasses(event)}
                              title="View Passes"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  id: event.id,
                                  active: !event.active,
                                })
                              }
                              title={event.active ? "Deactivate" : "Activate"}
                            >
                              {event.active ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(event)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Check-in Tab */}
        <TabsContent value="checkin">
          <Card>
            <CardHeader>
              <CardTitle>Check-in Attendees</CardTitle>
              <CardDescription>
                Select an event and check in attendees by pass ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Event Selection */}
                <div className="flex flex-wrap gap-2">
                  {events.map((event) => (
                    <Button
                      key={event.id}
                      variant={selectedEventForPasses?.id === event.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedEventForPasses(event)}
                    >
                      {event.title}
                    </Button>
                  ))}
                </div>

                {selectedEventForPasses && (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by pass ID or name..."
                        value={passSearch}
                        onChange={(e) => setPassSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Passes List */}
                    {passesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredPasses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No passes found for this event
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredPasses.map((pass) => (
                          <div
                            key={pass.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              pass.checkInStatus === "CHECKED_IN"
                                ? "bg-green-50 border-green-200"
                                : "bg-background"
                            )}
                          >
                            <div className="space-y-1">
                              <p className="font-mono text-sm font-medium">{pass.passId}</p>
                              <p className="text-sm text-muted-foreground">
                                {pass.booking?.customerName || "Unknown"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {pass.checkInStatus === "CHECKED_IN" ? (
                                <Badge className="bg-green-500">Checked In</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => checkinMutation.mutate({ passId: pass.passId })}
                                  disabled={checkinMutation.isPending}
                                >
                                  {checkinMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Check In"
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {!selectedEventForPasses && (
                  <div className="text-center py-8 text-muted-foreground">
                    Select an event above to view and check in passes
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
