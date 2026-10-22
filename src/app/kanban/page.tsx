"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAppContextStore } from "@/lib/store";
import { haptic } from "@/lib/native-features";
import { cn } from "@/lib/utils";
import { MAX_TAGS_PER_TASK, TASK_STATUSES, filterTasks, getDueMeta, isTaskStatus, sortTasks, groupTasksByStatus, parseTagInput, toInputDateValue } from "@/lib/tasks";
import { taskSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase/provider";
import { useActiveContext, useProjects, useTasks } from "@/firebase/user-data";
import { createTask, deleteTask, deleteTasks, setTaskStatus, updateTask } from "@/services/task-service";
import { createProject, updateProject, archiveProject } from "@/services/project-service";
import { restoreUserDocument, restoreUserDocuments } from "@/services/restore-service";
import { generateTasksFromPrompt } from "@/services/ai-task-service";
import { toastWithUndo } from "@/components/undo-toast";
import { TaskFormPanel, type TaskFormState } from "@/components/kanban/task-form-panel";
import { ProjectManager } from "@/components/kanban/project-manager";
import { StatusSection } from "@/components/kanban/status-section";
import { KanbanSummary, type KanbanViewMode } from "@/components/kanban/kanban-summary";
import { KanbanToolbar } from "@/components/kanban/kanban-toolbar";
import { QuickAddBar } from "@/components/kanban/quick-add-bar";
import { AiPlanner } from "@/components/kanban/ai-planner";
import { KanbanColumn } from "@/components/organisms/kanban-column";
import type { Priority, ProjectFormData, Task, TaskStatus } from "@/types/task";

const INITIAL_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  priority: "media",
  status: TASK_STATUSES[0],
  tags: "",
  dueDate: "",
  dueTime: "",
  recurrence: "",
  checklist: [],
  projectId: "",
};

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const activeContext = useActiveContext();
  const formPanelRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Firestore aplica las escrituras locales al instante (latency compensation),
  // así que no hace falta un estado optimista propio.
  const { data: tasks, isLoading: isTasksLoading } = useTasks(context);
  const { data: projects } = useProjects(context);

  const [viewMode, setViewMode] = useState<KanbanViewMode>("flow");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const kanbanSort = useAppContextStore((state) => state.kanbanSort);
  const setKanbanSort = useAppContextStore((state) => state.setKanbanSort);

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const visibleTasks = useMemo(
    () =>
      sortTasks(
        filterTasks(tasks, { priority: priorityFilter, projectId: projectFilter, query: searchQuery, onlyOverdue }),
        kanbanSort
      ),
    [tasks, priorityFilter, projectFilter, searchQuery, onlyOverdue, kanbanSort]
  );
  const groupedTasks = useMemo(() => groupTasksByStatus(visibleTasks), [visibleTasks]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "Hecho").length,
      inProgress: tasks.filter((task) => task.status === "Haciendo").length,
      pending: tasks.filter((task) => task.status === "Pendiente").length,
      critical: tasks.filter((task) => task.priority === "alta" && task.status !== "Hecho").length,
    }),
    [tasks]
  );
  const hasSearch = searchQuery.trim().length > 0;

  // Enlaces directos (atajos del manifest): ?new=1 enfoca "Añadir tarea", ?ai=1 abre la IA.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("new") && !params.has("ai")) return;
    if (params.has("ai")) setAiOpen(true);
    if (params.has("new")) requestAnimationFrame(() => quickAddRef.current?.focus());
    router.replace("/kanban");
  }, [user, router]);

  // Sin diálogo modal: el primer toque en "Limpiar Hechos" pide confirmación y el segundo borra.
  useEffect(() => {
    if (!confirmClearCompleted) return;
    const timeoutId = setTimeout(() => setConfirmClearCompleted(false), 4000);
    return () => clearTimeout(timeoutId);
  }, [confirmClearCompleted]);

  if (isUserLoading || !user) {
    return null;
  }

  const openTaskForm = (seed?: Partial<TaskFormState>, task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        tags: task.tags?.join(", ") || "",
        dueDate: toInputDateValue(task.dueDate),
        dueTime: task.dueTime || "",
        recurrence: task.recurrence || "",
        checklist: task.checklist || [],
        projectId: task.projectId || "",
      });
    } else {
      setEditingTask(null);
      setTaskForm({ ...INITIAL_TASK_FORM, ...seed });
    }

    setFormOpen(true);
    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeTaskForm = () => {
    setFormOpen(false);
    setEditingTask(null);
    setTaskForm(INITIAL_TASK_FORM);
  };

  /** Valida y guarda; devuelve false si la validación falla. */
  const saveTask = (draft: TaskFormState, taskToUpdate: Task | null, { silent = false } = {}): boolean => {
    const result = taskSchema.safeParse({
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      status: draft.status || TASK_STATUSES[0],
      tags: parseTagInput(draft.tags),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      ...(draft.dueDate && draft.dueTime ? { dueTime: draft.dueTime } : {}),
      ...(draft.dueDate && draft.recurrence ? { recurrence: draft.recurrence } : {}),
      // Se descartan subtareas vacías (p. ej. una recién agregada sin texto).
      checklist: draft.checklist.filter((item) => item.text.trim()),
      context,
      ...(draft.projectId ? { projectId: draft.projectId } : {}),
    });

    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return false;
    }

    if (taskToUpdate) {
      const cleared = (["dueDate", "dueTime", "recurrence", "projectId"] as const).filter(
        (field) => !(field in result.data) && taskToUpdate[field] !== undefined
      );
      updateTask(firestore, user.uid, taskToUpdate.id, result.data, [...cleared]);
      toast({ variant: "success", title: "Tarea actualizada" });
    } else {
      createTask(firestore, user.uid, result.data);
      if (!silent) toast({ variant: "success", title: "Tarea creada" });
    }
    return true;
  };

  const handleSubmitForm = () => {
    setIsSaving(true);
    try {
      if (saveTask(taskForm, editingTask)) closeTaskForm();
    } finally {
      setIsSaving(false);
    }
  };

  // La tarea aparece al instante en la lista: no hace falta aviso.
  const handleQuickCreate = (title: string) => saveTask({ ...INITIAL_TASK_FORM, title }, null, { silent: true });

  // Los tickets tienen campos propios: se editan en su página.
  const handleEdit = (task: Task) => {
    if (task.isTicket) {
      router.push(`/tickets?edit=${task.id}`);
      return;
    }
    openTaskForm(undefined, task);
  };

  const handleDeleteTask = (taskId: string) => {
    const deletedTask = tasks.find((task) => task.id === taskId);
    haptic(25);
    deleteTask(firestore, user.uid, taskId);

    if (!deletedTask) {
      toast({ variant: "warning", title: "Tarea eliminada" });
      return;
    }
    toastWithUndo({
      title: "Tarea eliminada",
      description: deletedTask.title,
      onUndo: () => restoreUserDocument(firestore, user.uid, "tasks", deletedTask),
    });
  };

  const handleMoveTask = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    haptic();
    const nextDueDate = setTaskStatus(firestore, user.uid, task, status);
    if (nextDueDate) {
      toast({ variant: "success", title: "Tarea recurrente", description: `Próxima: ${getDueMeta(nextDueDate, task.dueTime)?.label ?? nextDueDate}.` });
    }
  };

  const handleToggleChecklistItem = (task: Task, itemId: string) => {
    haptic();
    updateTask(firestore, user.uid, task.id, {
      checklist: (task.checklist ?? []).map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const overId = String(over.id);
    // Se puede soltar sobre una columna (id = estado) o sobre otra tarjeta.
    const targetStatus = tasks.find((task) => task.id === overId)?.status ?? overId;
    const currentTask = tasks.find((task) => task.id === active.id);
    if (currentTask && currentTask.status !== targetStatus && isTaskStatus(targetStatus)) {
      handleMoveTask(currentTask.id, targetStatus);
    }
  };

  const handleClearCompleted = async () => {
    const completedList = tasks.filter((task) => task.status === "Hecho");
    if (completedList.length === 0) {
      toast({ variant: "warning", title: "Sin tareas hechas", description: "No hay tareas completadas para limpiar." });
      return;
    }

    if (!confirmClearCompleted) {
      setConfirmClearCompleted(true);
      return;
    }
    setConfirmClearCompleted(false);

    try {
      await deleteTasks(firestore, user.uid, completedList.map((task) => task.id));
    } catch (error) {
      console.error("Error al limpiar tareas completadas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar las tareas completadas." });
      return;
    }

    toastWithUndo({
      title: "Tablero limpio",
      description: `Se eliminaron ${completedList.length} tareas completadas.`,
      onUndo: () => {
        restoreUserDocuments(firestore, user.uid, "tasks", completedList).catch((error) => {
          console.error("Error al restaurar tareas:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudieron restaurar las tareas." });
        });
      },
    });
  };

  const handleGenerateTasks = async (prompt: string) => {
    if (!prompt.trim()) return false;

    setIsGenerating(true);
    try {
      const generatedTasks = await generateTasksFromPrompt(user, prompt);
      const targetStatus = TASK_STATUSES[0];
      let createdCount = 0;

      for (const item of generatedTasks) {
        const normalized = taskSchema.safeParse({
          title: String(item.title ?? "").trim(),
          description: String(item.description ?? "").trim(),
          priority: item.priority,
          status: targetStatus,
          tags: Array.isArray(item.tags) ? parseTagInput(item.tags.map(String).join(",")) : [],
          dueDate: typeof item.dueDate === "string" && item.dueDate.trim() ? item.dueDate : undefined,
          context,
        });
        if (!normalized.success) continue;

        createTask(firestore, user.uid, normalized.data);
        createdCount += 1;
      }

      if (createdCount === 0) {
        throw new Error("La IA no generó tareas aprovechables.");
      }

      toast({ variant: "success", title: "Tareas creadas con IA", description: `${createdCount} tareas agregadas a ${targetStatus}.` });
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en IA",
        description: error instanceof Error ? error.message : "No se pudo procesar la solicitud.",
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProject = (data: ProjectFormData) => {
    createProject(firestore, user.uid, { ...data, context });
    toast({ variant: "success", title: "Proyecto creado" });
  };

  const handleUpdateProject = (projectId: string, data: ProjectFormData) => {
    updateProject(firestore, user.uid, projectId, { ...data });
    toast({ variant: "success", title: "Proyecto actualizado" });
  };

  const handleArchiveProject = (projectId: string) => {
    archiveProject(firestore, user.uid, projectId);
    if (projectFilter === projectId) setProjectFilter("all");
    toast({ variant: "warning", title: "Proyecto archivado" });
  };

  const clearCompletedButton = (
    <button
      type="button"
      onClick={handleClearCompleted}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors",
        confirmClearCompleted ? "bg-red-500/10 text-red-400" : "text-muted-foreground hover:text-red-400"
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {confirmClearCompleted ? `¿Borrar ${stats.completed}?` : "Limpiar"}
    </button>
  );

  return (
    <div className={cn("mx-auto w-full space-y-5 pb-12", viewMode === "board" ? "max-w-[1400px]" : "max-w-3xl")}>
      <KanbanSummary
        contextName={activeContext.name}
        {...stats}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <QuickAddBar
        onCreate={handleQuickCreate}
        onOpenDetails={(title) => openTaskForm({ title })}
        aiOpen={aiOpen}
        onToggleAi={() => setAiOpen((open) => !open)}
        inputRef={quickAddRef}
      />

      {aiOpen && <AiPlanner isGenerating={isGenerating} onGenerate={handleGenerateTasks} onClose={() => setAiOpen(false)} />}

      {/* Formulario embebido de tarea (crear/editar) — sin modal */}
      {formOpen && (
        <div ref={formPanelRef}>
          <TaskFormPanel
            isEditing={Boolean(editingTask)}
            value={taskForm}
            onChange={(patch) => setTaskForm((previous) => ({ ...previous, ...patch }))}
            onSubmit={handleSubmitForm}
            onCancel={closeTaskForm}
            isSaving={isSaving}
            statusOptions={TASK_STATUSES}
            projects={activeProjects}
            maxTags={MAX_TAGS_PER_TASK}
          />
        </div>
      )}

      <KanbanToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        projectFilter={projectFilter}
        onProjectFilterChange={setProjectFilter}
        projects={activeProjects}
        onlyOverdue={onlyOverdue}
        onOnlyOverdueChange={setOnlyOverdue}
        sort={kanbanSort}
        onSortChange={setKanbanSort}
        panelExtras={
          <>
            <ProjectManager
              projects={projects}
              onCreate={handleCreateProject}
              onUpdate={handleUpdateProject}
              onArchive={handleArchiveProject}
            />
            {stats.completed > 0 && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  {stats.completed === 1 ? "1 tarea completada" : `${stats.completed} tareas completadas`}
                </p>
                {clearCompletedButton}
              </div>
            )}
          </>
        }
      />

      <div>
        {isTasksLoading && visibleTasks.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-3xl border border-border bg-muted/15" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CheckCircle className="mx-auto w-12 h-12 text-muted-foreground/30 stroke-[1]" />
            <p className="mt-4 text-sm font-bold text-foreground">
              {hasSearch ? "No se encontraron tareas coincidentes." : "No hay tareas en esta categoría."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {hasSearch ? "Intenta con otra palabra clave." : "Escribe una en la barra de arriba para comenzar."}
            </p>
          </div>
        ) : viewMode === "flow" ? (
          <div className="space-y-2">
            {TASK_STATUSES.map((status) => (
              <StatusSection
                key={status}
                status={status}
                tasks={groupedTasks.get(status) || []}
                projectsById={projectsById}
                onAdd={(presetStatus) => openTaskForm({ status: presetStatus })}
                onEdit={handleEdit}
                onDelete={handleDeleteTask}
                onMove={handleMoveTask}
                onToggleChecklistItem={handleToggleChecklistItem}
                headerAction={status === "Hecho" && stats.completed > 0 ? clearCompletedButton : undefined}
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-6 overflow-x-auto pb-6 snap-x scrollbar-hide">
              {TASK_STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={groupedTasks.get(status) || []}
                  onDelete={handleDeleteTask}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
