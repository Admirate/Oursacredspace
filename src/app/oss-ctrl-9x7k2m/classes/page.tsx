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
  Edit,
  ToggleLeft,
  ToggleRight,
  CalendarIcon,
  X,
  Image as ImageIcon,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ClassSession, TimeSlot } from "@/types";

// ─── Helpers ─────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatPrice = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);

const formatTime12 = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const formatTimeRange = (start: string, end: string): string =>
  `${formatTime12(start)} - ${formatTime12(end)}`;

const formatRecurrenceDays = (days: number[]): string => {
  if (!days || days.length === 0) return "";
  if (days.length === 1) return `Every ${DAY_NAMES_FULL[days[0]]}`;
  const sorted = [...days].sort();
  return `Every ${sorted.map((d) => DAY_NAMES[d]).join(" & ")}`;
};

const formatScheduleColumn = (item: any): string => {
  if (item.isRecurring) return formatRecurrenceDays(item.recurrenceDays);
  return new Date(item.startsAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatTimeSlotsColumn = (item: any): string => {
  const slots: TimeSlot[] | null = item.timeSlots;
  if (slots && slots.length > 0) {
    return slots.map((s) => formatTimeRange(s.startTime, s.endTime)).join(", ");
  }
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + item.duration * 60 * 1000);
  const startStr = `${start.getHours().toString().padStart(2, "0")}:${start.getMinutes().toString().padStart(2, "0")}`;
  const endStr = `${end.getHours().toString().padStart(2, "0")}:${end.getMinutes().toString().padStart(2, "0")}`;
  return formatTimeRange(startStr, endStr);
};

// ─── Image Upload ────────────────────────────────────────

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
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be less than 5MB"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const response = await adminApi.uploadImage(base64, file.name, "classes");
        if (response.success && response.data?.url) onChange(response.data.url);
      } catch { alert("Failed to upload image."); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
            <Image src={value} alt="Class image" fill className="object-cover" />
            <button type="button" onClick={onRemove} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600" aria-label="Remove image">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-gray-50">
            {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-gray-400" /> : <><ImageIcon className="h-6 w-6 text-gray-400 mb-1" /><span className="text-[10px] text-gray-500">Upload</span></>}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={isUploading} />
      </div>
    </div>
  );
};

// ─── Form Schema ─────────────────────────────────────────

const classFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startsAt: z.date().optional(),
  startsAtTime: z.string().optional(),
  endsAt: z.date().optional(),
  endsAtTime: z.string().optional(),
  duration: z.coerce.number().min(15, "Min 15 minutes"),
  capacity: z.coerce.number().min(0).optional().or(z.literal("")),
  pricePaise: z.coerce.number().min(0, "Price must be 0 or more"),
  isRecurring: z.boolean().default(false),
  pricingType: z.enum(["PER_SESSION", "PER_MONTH"]).default("PER_SESSION"),
});

type ClassFormData = z.infer<typeof classFormSchema>;

// ─── Page Component ──────────────────────────────────────

type StatusFilter = "all" | "active" | "inactive" | "expired";
type TypeFilter = "all" | "recurring" | "one-time";

export default function AdminClassesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [unlimitedCapacity, setUnlimitedCapacity] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: () => adminApi.listClasses(),
  });

  const form = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: 60,
      capacity: 10,
      pricePaise: 500,
      startsAtTime: "10:00",
      isRecurring: false,
      pricingType: "PER_SESSION",
    },
  });

  const isRecurring = form.watch("isRecurring");
  const pricingType = form.watch("pricingType");

  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.createClass(data),
    onSuccess: () => {
      toast({ title: "Class created successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      handleDialogClose();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create class", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateClass(id, data),
    onSuccess: () => {
      toast({ title: "Class updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      handleDialogClose();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update class", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteClass(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "classes"] });
      const previousData = queryClient.getQueryData(["admin", "classes"]);
      queryClient.setQueryData(["admin", "classes"], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((c: any) => c.id !== id) };
      });
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Class deleted" });
    },
    onError: (error: Error, _id, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin", "classes"], context.previousData);
      }
      toast({ title: "Failed to delete class", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => adminApi.updateClass(id, { active }),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "classes"] });
      const previousData = queryClient.getQueryData(["admin", "classes"]);
      queryClient.setQueryData(["admin", "classes"], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((c: any) => c.id === id ? { ...c, active } : c) };
      });
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Class status updated" });
    },
    onError: (error: Error, _variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin", "classes"], context.previousData);
      }
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
  });

  const handleSubmit = (data: ClassFormData) => {
    let startsAtISO = new Date().toISOString();
    if (data.startsAt) {
      const [hours, minutes] = (data.startsAtTime || "10:00").split(":").map(Number);
      const startsAt = new Date(data.startsAt);
      startsAt.setHours(hours, minutes, 0, 0);
      startsAtISO = startsAt.toISOString();
    }

    let endsAtISO: string | null = null;
    if (data.endsAt) {
      const [eH, eM] = (data.endsAtTime || "23:59").split(":").map(Number);
      const endsAt = new Date(data.endsAt);
      endsAt.setHours(eH, eM, 0, 0);
      endsAtISO = endsAt.toISOString();
    }

    const classData: any = {
      title: data.title,
      description: data.description || null,
      imageUrl: imageUrl,
      startsAt: startsAtISO,
      endsAt: endsAtISO,
      duration: data.duration,
      capacity: unlimitedCapacity ? null : (data.capacity === "" ? null : Number(data.capacity)),
      pricePaise: data.pricePaise * 100,
      active: true,
      isRecurring: data.isRecurring,
      recurrenceDays: data.isRecurring ? recurrenceDays : [],
      timeSlots: timeSlots.length > 0 ? timeSlots : null,
      pricingType: data.pricingType,
    };

    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, data: classData });
    } else {
      createMutation.mutate(classData);
    }
  };

  const handleEdit = (classItem: ClassSession) => {
    setEditingClass(classItem);
    setImageUrl(classItem.imageUrl || null);
    setUnlimitedCapacity(classItem.capacity === null || classItem.capacity === undefined);
    setRecurrenceDays(classItem.recurrenceDays || []);
    setTimeSlots((classItem.timeSlots as TimeSlot[]) || []);
    const startsAt = new Date(classItem.startsAt);
    const endsAt = classItem.endsAt ? new Date(classItem.endsAt) : undefined;
    form.reset({
      title: classItem.title,
      description: classItem.description || "",
      startsAt: startsAt,
      startsAtTime: `${startsAt.getHours().toString().padStart(2, "0")}:${startsAt.getMinutes().toString().padStart(2, "0")}`,
      endsAt: endsAt,
      endsAtTime: endsAt ? `${endsAt.getHours().toString().padStart(2, "0")}:${endsAt.getMinutes().toString().padStart(2, "0")}` : undefined,
      duration: classItem.duration,
      capacity: classItem.capacity ?? "",
      pricePaise: classItem.pricePaise / 100,
      isRecurring: classItem.isRecurring || false,
      pricingType: classItem.pricingType || "PER_SESSION",
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingClass(null);
    setImageUrl(null);
    setUnlimitedCapacity(false);
    setRecurrenceDays([]);
    setTimeSlots([]);
    form.reset();
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const addTimeSlot = () => setTimeSlots((prev) => [...prev, { startTime: "16:00", endTime: "17:00" }]);
  const removeTimeSlot = (i: number) => setTimeSlots((prev) => prev.filter((_, idx) => idx !== i));
  const updateTimeSlot = (i: number, field: keyof TimeSlot, value: string) =>
    setTimeSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const allClasses: any[] = data?.data || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredClasses = allClasses.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchesTitle = c.title?.toLowerCase().includes(query);
      const matchesDesc = c.description?.toLowerCase().includes(query);
      const matchesInstructor = c.instructor?.toLowerCase().includes(query);
      const matchesLocation = c.location?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc && !matchesInstructor && !matchesLocation) return false;
    }

    if (statusFilter === "active" && !c.active) return false;
    if (statusFilter === "inactive" && (c.active || c.isExpired)) return false;
    if (statusFilter === "expired" && !(c.isExpired && !c.active)) return false;

    if (typeFilter === "recurring" && !c.isRecurring) return false;
    if (typeFilter === "one-time" && c.isRecurring) return false;

    return true;
  });

  const statusCounts = {
    all: allClasses.length,
    active: allClasses.filter((c) => c.active).length,
    inactive: allClasses.filter((c) => !c.active && !c.isExpired).length,
    expired: allClasses.filter((c) => c.isExpired && !c.active).length,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Classes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage class sessions and workshops</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogTrigger asChild>
            <Button onClick={() => { handleDialogClose(); setIsDialogOpen(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
              <DialogDescription>{editingClass ? "Update class details" : "Create a new class session"}</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Title */}
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Yoga for Beginners" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                {/* Description */}
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the class..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                {/* Image */}
                <div>
                  <FormLabel>Image</FormLabel>
                  <div className="mt-2">
                    <ImageUpload value={imageUrl} onChange={(url) => { setIsUploading(false); setImageUrl(url); }} onRemove={() => setImageUrl(null)} isUploading={isUploading} />
                  </div>
                </div>

                {/* Pricing Type */}
                <div>
                  <FormLabel>Pricing</FormLabel>
                  <div className="flex gap-2 mt-2">
                    {(["PER_SESSION", "PER_MONTH"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => form.setValue("pricingType", type)}
                        className={cn(
                          "px-4 py-2 text-sm rounded-lg border transition-colors",
                          pricingType === type ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                        )}
                      >
                        {type === "PER_SESSION" ? "Per Session" : "Per Month"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price + Capacity */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pricePaise" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{pricingType === "PER_MONTH" ? "Monthly Price (₹)" : "Price (₹)"}</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div>
                    <FormLabel>Capacity</FormLabel>
                    <div className="mt-2">
                      {unlimitedCapacity ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Unlimited</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setUnlimitedCapacity(false)}>Set limit</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FormField control={form.control} name="capacity" render={({ field }) => (
                            <FormControl><Input type="number" min="0" className="w-24" {...field} /></FormControl>
                          )} />
                          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setUnlimitedCapacity(true)}>Unlimited</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recurring Toggle */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Recurring Class</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => form.setValue("isRecurring", !isRecurring)}
                      className={cn("w-10 h-6 rounded-full transition-colors relative", isRecurring ? "bg-primary" : "bg-gray-300")}
                    >
                      <span className={cn("block w-4 h-4 bg-white rounded-full absolute top-1 transition-transform", isRecurring ? "translate-x-5" : "translate-x-1")} />
                    </button>
                  </div>

                  {isRecurring && (
                    <>
                      {/* Day Picker */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Repeat on</p>
                        <div className="flex gap-1.5">
                          {DAY_NAMES.map((name, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleDay(i)}
                              className={cn(
                                "w-10 h-10 rounded-full text-xs font-medium transition-colors",
                                recurrenceDays.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                              )}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Time Slots */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Time Slots</p>
                          <Button type="button" variant="outline" size="sm" onClick={addTimeSlot}>+ Add Slot</Button>
                        </div>
                        {timeSlots.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No slots added. Click "Add Slot" to create one.</p>
                        )}
                        <div className="space-y-2">
                          {timeSlots.map((slot, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1})</span>
                              <Input type="time" value={slot.startTime} onChange={(e) => updateTimeSlot(i, "startTime", e.target.value)} className="w-28" />
                              <span className="text-sm text-muted-foreground">to</span>
                              <Input type="time" value={slot.endTime} onChange={(e) => updateTimeSlot(i, "endTime", e.target.value)} className="w-28" />
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeTimeSlot(i)}><X className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Date / Time (for non-recurring or as start date for recurring) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="startsAt" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>{isRecurring ? "Starts From" : "Date"}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : "Pick date"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {!isRecurring && (
                    <FormField control={form.control} name="startsAtTime" render={({ field }) => (
                      <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}

                  {isRecurring && (
                    <FormField control={form.control} name="duration" render={({ field }) => (
                      <FormItem><FormLabel>Duration (mins)</FormLabel><FormControl><Input type="number" min="15" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                </div>

                {!isRecurring && (
                  <FormField control={form.control} name="duration" render={({ field }) => (
                    <FormItem><FormLabel>Duration (mins)</FormLabel><FormControl><Input type="number" min="15" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}

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

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={handleDialogClose}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : editingClass ? "Update Class" : "Create Class"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, description, instructor, or location..."
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {(["all", "active", "expired", "inactive"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors capitalize whitespace-nowrap",
                  statusFilter === status
                    ? "bg-sacred-green text-white border-sacred-green"
                    : "bg-background hover:bg-muted border-border"
                )}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}{" "}
                <span className="text-[10px] sm:text-xs opacity-75">({statusCounts[status]})</span>
              </button>
            ))}
          </div>
          <div className="h-px w-full sm:h-5 sm:w-px bg-border" />
          <div className="flex items-center gap-1 sm:gap-1.5">
            {(["all", "recurring", "one-time"] as TypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-full border transition-colors whitespace-nowrap",
                  typeFilter === type
                    ? "bg-sacred-burgundy text-white border-sacred-burgundy"
                    : "bg-background hover:bg-muted border-border"
                )}
              >
                {type === "all" ? "All Types" : type === "recurring" ? "Recurring" : "One-time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="text-center py-16 text-destructive">Failed to load classes. Please try again.</div>
          ) : allClasses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No classes found. Create your first class!</div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No classes match your search or filters.</p>
              <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }} className="text-sm text-sacred-green hover:underline mt-1">
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
                      <TableHead>Class</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClasses.map((classItem) => (
                      <TableRow key={classItem.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {classItem.imageUrl ? (
                              <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                                <Image src={classItem.imageUrl} alt={classItem.title} fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{classItem.title}</p>
                              {classItem.isRecurring && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Recurring</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{formatScheduleColumn(classItem)}</div>
                          {classItem.endsAt && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Ends: {new Date(classItem.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatTimeSlotsColumn(classItem)}</TableCell>
                        <TableCell>
                          {classItem.capacity === null || classItem.capacity === undefined
                            ? <span className="text-muted-foreground text-xs">Unlimited</span>
                            : `${classItem.spotsBooked}/${classItem.capacity}`}
                        </TableCell>
                        <TableCell>
                          {formatPrice(classItem.pricePaise)}
                          <span className="text-xs text-muted-foreground">
                            {classItem.pricingType === "PER_MONTH" ? "/mo" : "/session"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {classItem.isExpired && !classItem.active ? (
                            <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600">Expired</Badge>
                          ) : (
                            <Badge variant={classItem.active ? "default" : "secondary"}>{classItem.active ? "Active" : "Inactive"}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate({ id: classItem.id, active: !classItem.active })} title={classItem.active ? "Deactivate" : "Activate"}>
                              {classItem.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(classItem)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="Delete class"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete class?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete &ldquo;{classItem.title}&rdquo;. Existing bookings are unaffected.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(classItem.id)}>Delete</AlertDialogAction>
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
                {filteredClasses.map((classItem) => (
                  <div key={classItem.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {classItem.imageUrl ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                          <Image src={classItem.imageUrl} alt={classItem.title} fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{classItem.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {classItem.isRecurring && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Recurring</span>
                              )}
                              {classItem.isExpired && !classItem.active ? (
                                <Badge variant="destructive" className="bg-amber-500 hover:bg-amber-600 text-[10px] h-5">Expired</Badge>
                              ) : (
                                <Badge variant={classItem.active ? "default" : "secondary"} className="text-[10px] h-5">{classItem.active ? "Active" : "Inactive"}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleActiveMutation.mutate({ id: classItem.id, active: !classItem.active })}>
                              {classItem.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(classItem)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete class?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete &ldquo;{classItem.title}&rdquo;. Existing bookings are unaffected.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(classItem.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground pl-0.5">
                      <div><span className="font-medium text-foreground">Schedule:</span> {formatScheduleColumn(classItem)}</div>
                      <div><span className="font-medium text-foreground">Time:</span> {formatTimeSlotsColumn(classItem)}</div>
                      <div><span className="font-medium text-foreground">Capacity:</span> {classItem.capacity == null ? "Unlimited" : `${classItem.spotsBooked}/${classItem.capacity}`}</div>
                      <div><span className="font-medium text-foreground">Price:</span> {formatPrice(classItem.pricePaise)}{classItem.pricingType === "PER_MONTH" ? "/mo" : "/session"}</div>
                      {classItem.endsAt && (
                        <div className="col-span-2"><span className="font-medium text-foreground">Ends:</span> {new Date(classItem.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
