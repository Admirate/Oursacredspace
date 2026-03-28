"use client";

import { useState, useRef } from "react";
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
  X,
  Image as ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  endsAt: z.date().optional(),
  endsAtTime: z.string().optional(),
  venue: z.string().min(2, "Venue is required"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1").optional(),
  pricePaise: z.coerce.number().min(0, "Price must be 0 or more"),
});

type EventFormData = z.infer<typeof eventFormSchema>;

// Image upload component
const ImageUpload = ({
  value,
  onChange,
  onRemove,
  isUploading,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove: () => void;
  isUploading: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const response = await adminApi.uploadImage(base64, file.name, "events");
        if (response.success && response.data?.url) {
          onChange(response.data.url);
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to upload image. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
            <Image
              src={value}
              alt="Event image"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors"
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">Click to upload</span>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Max 5MB. Recommended: 800x600px
      </p>
    </div>
  );
};

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
};

const formatTime12 = (date: Date): string => {
  return date.toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatDateRange = (startsAt: string, endsAt?: string | null): string => {
  const start = new Date(startsAt);
  if (!endsAt) {
    return start.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  }
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · ${formatTime12(start)} - ${formatTime12(end)}`;
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-IN", { month: "short" })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
};

const PAGE_SIZE = 20;

type EventStatusFilter = "all" | "active" | "inactive" | "expired";

export default function AdminEventsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEventForPasses, setSelectedEventForPasses] = useState<Event | null>(null);
  const [passSearch, setPassSearch] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteEvent(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "events"] });
      const previousData = queryClient.getQueryData(["admin", "events"]);
      queryClient.setQueryData(["admin", "events"], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((e: any) => e.id !== id) };
      });
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Event deleted" });
    },
    onError: (error: Error, _id, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin", "events"], context.previousData);
      }
      toast({ title: "Failed to delete event", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "events"] });
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

    let endsAtISO: string | null = null;
    if (data.endsAt) {
      const [eH, eM] = (data.endsAtTime || "23:59").split(":").map(Number);
      const endsAt = new Date(data.endsAt);
      endsAt.setHours(eH, eM, 0, 0);
      endsAtISO = endsAt.toISOString();
    }

    const eventData: any = {
      title: data.title,
      description: data.description || null,
      imageUrl: imageUrl,
      startsAt: startsAt.toISOString(),
      endsAt: endsAtISO,
      venue: data.venue,
      capacity: data.capacity || null,
      pricePaise: data.pricePaise * 100,
      active: true,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: eventData });
    } else {
      createMutation.mutate(eventData);
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setImageUrl(event.imageUrl || null);
    const startsAt = new Date(event.startsAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : undefined;
    form.reset({
      title: event.title,
      description: event.description || "",
      startsAt: startsAt,
      startsAtTime: `${startsAt.getHours().toString().padStart(2, "0")}:${startsAt.getMinutes().toString().padStart(2, "0")}`,
      endsAt: endsAt,
      endsAtTime: endsAt ? `${endsAt.getHours().toString().padStart(2, "0")}:${endsAt.getMinutes().toString().padStart(2, "0")}` : undefined,
      venue: event.venue,
      capacity: event.capacity || undefined,
      pricePaise: event.pricePaise / 100,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    setImageUrl(null);
    form.reset();
  };

  const allEvents: any[] = data?.data || [];
  const passes: any[] = passesData?.data || [];
  const filteredPasses = passes.filter((pass: any) =>
    passSearch
      ? pass.passId.toLowerCase().includes(passSearch.toLowerCase()) ||
        pass.booking?.customerName?.toLowerCase().includes(passSearch.toLowerCase())
      : true
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredEvents = allEvents.filter((e) => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchesTitle = e.title?.toLowerCase().includes(query);
      const matchesDesc = e.description?.toLowerCase().includes(query);
      const matchesVenue = e.venue?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc && !matchesVenue) return false;
    }

    if (statusFilter === "active" && !e.active) return false;
    if (statusFilter === "inactive" && (e.active || e.isExpired)) return false;
    if (statusFilter === "expired" && !(e.isExpired && !e.active)) return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEvents = filteredEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const eventStatusCounts = {
    all: allEvents.length,
    active: allEvents.filter((e) => e.active).length,
    inactive: allEvents.filter((e) => !e.active && !e.isExpired).length,
    expired: allEvents.filter((e) => e.isExpired && !e.active).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Events</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage events and check-in attendees
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingEvent(null); setImageUrl(null); form.reset(); setIsDialogOpen(true); }} className="w-full sm:w-auto">
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

                {/* Image Upload */}
                <div>
                  <FormLabel>Event Image</FormLabel>
                  <div className="mt-2">
                    <ImageUpload
                      value={imageUrl}
                      onChange={(url) => {
                        setIsUploading(false);
                        setImageUrl(url);
                      }}
                      onRemove={() => setImageUrl(null)}
                      isUploading={isUploading}
                    />
                  </div>
                </div>

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

                {/* End Date / Time */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="endsAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date (optional)</FormLabel>
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
                                {field.value ? format(field.value, "PPP") : "Pick end date"}
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
                    name="endsAtTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
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
        <TabsContent value="events" className="space-y-4">
          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 text-sm sm:text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(["all", "active", "expired", "inactive"] as EventStatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                  className={cn(
                    "px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors capitalize whitespace-nowrap",
                    statusFilter === status
                      ? "bg-sacred-green text-white border-sacred-green"
                      : "bg-background hover:bg-muted border-border"
                  )}
                >
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                  <span className="text-[10px] sm:text-xs opacity-75">({eventStatusCounts[status]})</span>
                </button>
              ))}
            </div>
          </div>

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
              ) : allEvents.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  No events found. Create your first event!
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No events match your search or filters.</p>
                  <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-sm text-sacred-green hover:underline mt-1">
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
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
                        {paginatedEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {event.imageUrl ? (
                                  <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                    <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <ImageIcon className="h-5 w-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{event.title}</p>
                                  {event.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">{event.description}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{formatDateRange(event.startsAt, event.endsAt)}</TableCell>
                            <TableCell>{event.venue}</TableCell>
                            <TableCell>{event.passesIssued || 0}{event.capacity && `/${event.capacity}`}</TableCell>
                            <TableCell>{formatPrice(event.pricePaise)}</TableCell>
                            <TableCell>
                              {event.isExpired && !event.active ? (
                                <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600">Expired</Badge>
                              ) : (
                                <Badge variant={event.active ? "default" : "secondary"}>{event.active ? "Active" : "Inactive"}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedEventForPasses(event)} title="View Passes">
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate({ id: event.id, active: !event.active })} title={event.active ? "Deactivate" : "Activate"}>
                                  {event.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(event)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" title="Delete event"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete event?</AlertDialogTitle>
                                      <AlertDialogDescription>This will permanently delete &ldquo;{event.title}&rdquo;. Existing bookings and passes are unaffected.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(event.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="md:hidden divide-y">
                    {paginatedEvents.map((event) => (
                      <div key={event.id} className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          {event.imageUrl ? (
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                              <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{event.title}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {event.isExpired && !event.active ? (
                                    <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600 text-[10px] h-5">Expired</Badge>
                                  ) : (
                                    <Badge variant={event.active ? "default" : "secondary"} className="text-[10px] h-5">{event.active ? "Active" : "Inactive"}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedEventForPasses(event)}>
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleActiveMutation.mutate({ id: event.id, active: !event.active })}>
                                  {event.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(event)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete event?</AlertDialogTitle>
                                      <AlertDialogDescription>This will permanently delete &ldquo;{event.title}&rdquo;. Existing bookings and passes are unaffected.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(event.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground pl-0.5">
                          <div><span className="font-medium text-foreground">Date:</span> {formatDateRange(event.startsAt, event.endsAt)}</div>
                          <div><span className="font-medium text-foreground">Venue:</span> {event.venue}</div>
                          <div><span className="font-medium text-foreground">Passes:</span> {event.passesIssued || 0}{event.capacity ? `/${event.capacity}` : ""}</div>
                          <div><span className="font-medium text-foreground">Price:</span> {formatPrice(event.pricePaise)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredEvents.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                      <span>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-2">{safePage} / {totalPages}</span>
                        <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
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
                  {allEvents.map((event) => (
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
