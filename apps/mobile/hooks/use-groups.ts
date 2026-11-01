import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGroupInput,
  GroupDetailResponse,
  GroupListResponse,
  JoinGroupInput,
} from '@mp/shared';
import { api } from '@/services/api';

export function useGroups() {
  return useQuery<GroupListResponse>({
    queryKey: ['groups'],
    queryFn: () => api.get<GroupListResponse>('/groups'),
  });
}

export function useGroup(id: string | undefined) {
  return useQuery<GroupDetailResponse>({
    queryKey: ['groups', id],
    queryFn: () => api.get<GroupDetailResponse>(`/groups/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGroupInput) => api.post<GroupDetailResponse>('/groups', data),
    onSuccess: (newGroup) => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.setQueryData(['groups', newGroup.id], newGroup);
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JoinGroupInput) => api.post<GroupDetailResponse>('/groups/join', data),
    onSuccess: (joinedGroup) => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.setQueryData(['groups', joinedGroup.id], joinedGroup);
    },
  });
}
