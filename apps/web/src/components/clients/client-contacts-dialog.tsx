'use client';
import type { ClientContactInput, ClientRef } from '@conit/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@conit/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { notify } from '@/lib/notify';
import { supportService } from '@/services/support.service';

export function ClientContactsDialog({
  client,
  onClose,
}: {
  client: ClientRef;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const key = ['client-contacts', client.id];
  const query = useQuery({ queryKey: key, queryFn: () => supportService.contacts(client.id) });
  const [input, setInput] = useState<ClientContactInput>({
    name: '',
    phone: '',
    email: '',
    role: '',
    verified: false,
  });
  const [editingId, setEditingId] = useState<string | undefined>();
  const save = useMutation({
    mutationFn: () =>
      supportService.saveContact(
        client.id,
        { ...input, email: input.email || undefined, role: input.role || undefined },
        editingId,
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: key });
      notify.success('Contacto guardado');
      setEditingId(undefined);
      setInput({ name: '', phone: '', email: '', role: '', verified: false });
    },
    onError: (error) => notify.fromError(error, 'No se pudo guardar el contacto'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => supportService.deleteContact(client.id, id),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: key });
    },
    onError: (error) => notify.fromError(error, 'No se pudo eliminar el contacto'),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contactos de {client.name}</DialogTitle>
          <DialogDescription>
            Registra teléfonos con código de país. Verifica la identidad antes de habilitar el
            acceso a sus servicios y tickets.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p>Cargando contactos…</p>
        ) : query.isError ? (
          <p role="alert">No se pudieron cargar los contactos.</p>
        ) : (
          <ul className="space-y-3">
            {query.data?.map((contact) => (
              <li
                key={contact.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-2"
              >
                <div>
                  <p className="text-sm font-medium">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    +{contact.phone} · {contact.verifiedAt ? 'Verificado' : 'Sin verificar'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contact.email} {contact.role}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(contact.id);
                      setInput({
                        name: contact.name,
                        phone: contact.phone,
                        email: contact.email ?? '',
                        role: contact.role ?? '',
                        verified: Boolean(contact.verifiedAt),
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(contact.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-sm">
            Nombre
            <Input
              value={input.name}
              maxLength={120}
              required
              onChange={(event) => setInput({ ...input, name: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Teléfono (sin código de país se asume Perú, +51)
            <Input
              value={input.phone}
              placeholder="+51 987 654 321"
              inputMode="tel"
              pattern="[+0-9 ()\-]{8,22}"
              required
              onChange={(event) =>
                setInput({ ...input, phone: event.target.value, verified: false })
              }
            />
          </label>
          <label className="text-sm">
            Correo
            <Input
              type="email"
              value={input.email}
              onChange={(event) => setInput({ ...input, email: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Cargo
            <Input
              value={input.role}
              maxLength={100}
              onChange={(event) => setInput({ ...input, role: event.target.value })}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={input.verified}
              onChange={(event) => setInput({ ...input, verified: event.target.checked })}
            />
            Confirmé la identidad de esta persona
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending}>
              Guardar contacto
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setEditingId(undefined);
                  setInput({ name: '', phone: '', email: '', role: '', verified: false });
                }}
              >
                Nuevo contacto
              </Button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
