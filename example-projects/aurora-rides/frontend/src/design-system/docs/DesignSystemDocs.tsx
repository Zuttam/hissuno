import { Fragment } from "react";
import { auroraTheme } from "../theme";
import { Button } from "../components/button";
import { Card, CardContent, CardHeader } from "../components/card";
import { Input } from "../components/input";
import { Tag } from "../components/tag";
import { Grid, Page, PageHeader, Section, Stack } from "../components/layout";

const colourTokens = Object.entries(auroraTheme.colors);
const spacingTokens = Object.entries(auroraTheme.spacing);
const typographyTokens = Object.entries(auroraTheme.typography);

const tones = ["neutral", "info", "success", "warning", "danger"] as const;

export const DesignSystemDocs = () => {
  return (
    <Page>
      <PageHeader>
        <h1>Aurora Design System</h1>
        <p>
          Tokens and primitives that shape the Aurora Rides experience. These foundations intentionally balance high-contrast
          dark mode surfaces with vivid aurora-inspired accents.
        </p>
      </PageHeader>

      <Section>
        <h2>Color tokens</h2>
        <Grid columns={5} gap="sm" className="design-docs__swatches">
          {colourTokens.map(([name, value]) => (
            <div key={name} className="design-docs__swatch">
              <span className="design-docs__swatch-chip" style={{ background: value }} />
              <span className="design-docs__swatch-name">{name}</span>
              <span className="design-docs__swatch-value">{value}</span>
            </div>
          ))}
        </Grid>
      </Section>

      <Section>
        <h2>Spacing scale</h2>
        <Stack gap="sm">
          {spacingTokens.map(([name, value]) => (
            <div key={name} className="design-docs__spacing">
              <span>{name}</span>
              <span className="design-docs__spacing-bar" style={{ width: `calc(${value} * 6)` }} />
              <span className="design-docs__spacing-value">{value}</span>
            </div>
          ))}
        </Stack>
      </Section>

      <Section>
        <h2>Typography</h2>
        <Grid columns={3} gap="lg">
          {typographyTokens.map(([name, value]) => (
            <div key={name} className="design-docs__token">
              <span className="design-docs__token-name">{name}</span>
              <span className="design-docs__token-value">{String(value)}</span>
            </div>
          ))}
        </Grid>
      </Section>

      <Section>
        <h2>Buttons</h2>
        <Stack gap="lg">
          <Stack direction="row" gap="md">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </Stack>
          <Stack direction="row" gap="md">
            <Button size="sm" variant="secondary">
              Small
            </Button>
            <Button size="md" variant="primary">
              Medium
            </Button>
            <Button size="lg" variant="primary">
              Large
            </Button>
          </Stack>
        </Stack>
      </Section>

      <Section>
        <h2>Inputs</h2>
        <Grid columns={2} gap="lg">
          <Input label="Pickup location" placeholder="1180 Market Street" hint="Supports live place predictions." />
          <Input
            label="Driver badge"
            placeholder="Enter badge ID"
            tone="success"
            description="Use the unique driver badge generated during onboarding."
          />
          <Input label="Vehicle plate" placeholder="7ABC123" error="Plate is already assigned to a driver." tone="danger" />
          <Input label="ETA override" placeholder="00:10:00" hint="Set custom ETA when traffic deviates 20%+" tone="warning" />
        </Grid>
      </Section>

      <Section>
        <h2>Tags</h2>
        <Stack direction="row" gap="md">
          {tones.map((tone) => (
            <Fragment key={tone}>
              <Tag tone={tone} variant="soft">
                {tone}
              </Tag>
              <Tag tone={tone} variant="solid">
                {tone}
              </Tag>
              <Tag tone={tone} variant="outline">
                {tone}
              </Tag>
            </Fragment>
          ))}
        </Stack>
      </Section>

      <Section>
        <h2>Card layouts</h2>
        <Grid columns={2} gap="lg">
          <Card interactive>
            <CardHeader leadingAccessory={<span className="design-docs__glow-dot" />} trailingAccessory={<Tag tone="info">Live</Tag>}>
              <div>
                <h3>Operations pulse</h3>
                <p>Quick indicator of supply vs demand balance for the last 15 minutes.</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="design-docs__metric">
                <span>Supply coverage</span>
                <strong>92%</strong>
              </div>
              <div className="design-docs__metric-trend positive">+6.3% vs previous slice</div>
            </CardContent>
          </Card>

          <Card variant="highlight" tone="positive">
            <CardHeader>
              <div>
                <h3>Driver NPS</h3>
                <p>Rolling 7-day satisfaction score for active drivers.</p>
              </div>
            </CardHeader>
            <CardContent>
              <Stack direction="row" align="center" gap="lg">
                <div className="design-docs__metric-large">62</div>
                <Stack gap="sm">
                  <span className="design-docs__mini-label">Goal</span>
                  <span>60</span>
                  <span className="design-docs__mini-label">Trend</span>
                  <span className="design-docs__metric-trend positive">▲ 3.5</span>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Section>
    </Page>
  );
};

