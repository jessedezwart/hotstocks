<script lang="ts">
  import { page } from '$app/stores';
  import FriendsView from '$lib/components/FriendsView.svelte';

  $: userId = $page.url.searchParams.get('userId');
  $: strategyId = $page.url.searchParams.get('strategyId');
</script>

<FriendsView {userId} {strategyId} />
