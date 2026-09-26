import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function Loading() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Loading">
      <Skeleton variant="text" width={260} height={44} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} variant="rounded" height={100} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={280} />
    </Stack>
  );
}
