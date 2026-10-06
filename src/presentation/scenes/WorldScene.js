import { Container } from 'pixi.js';
import { WorldState } from '../../game/world/WorldState.js';
import { WorldCamera } from '../../engine/camera/WorldCamera.js';
import { createStarterShip } from '../../game/ships/createStarterShip.js';
import { ShipNavigationSystem } from '../../game/systems/ShipNavigationSystem.js';
import { TreasureCollectionSystem } from '../../game/systems/TreasureCollectionSystem.js';
import { TreasureSpawnSystem } from '../../game/systems/TreasureSpawnSystem.js';
import { resolveReward } from '../../game/rewards/RewardCatalog.js';
import { grantReward } from '../../game/rewards/RewardGrantService.js';
import { createMathChallenge } from '../../game/math/createMathChallenge.js';
import { OceanRenderer } from '../world/OceanRenderer.js';
import { ShipRenderer } from '../ships/ShipRenderer.js';
import { ShipWakeRenderer } from '../ships/ShipWakeRenderer.js';
import { TreasureRenderer } from '../treasures/TreasureRenderer.js';
import { MathChallengeModal } from '../hud/math/MathChallengeModal.js';
import {
  STARTER_REGION,
  clampPointToRegion
} from '../../game/world/RegionDefinition.js';

const normalizeDegrees = (value) =>
  ((value % 360) + 360) % 360;

const CAMERA_FOLLOW_SHARPNESS = 4.5;

const cameraBoundaryPadding = (renderer, camera) => {
  const halfViewWidth =
    renderer.screen.width / (2 * camera.zoom);

  const halfViewHeight =
    renderer.screen.height / (2 * camera.zoom);

  return Math.max(
    56,
    halfViewWidth,
    halfViewHeight
  );
};

const lerpAngle = (from, to, alpha) => {
  const a = normalizeDegrees(from);
  const b = normalizeDegrees(to);
  let delta = b - a;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  return normalizeDegrees(a + delta * alpha);
};

export class WorldScene {
  constructor({
    renderer,
    assets,
    input,
    session,
    persistence,
    worldId = 'ocean'
  }) {
    this.renderer = renderer;
    this.assets = assets;
    this.input = input;
    this.session = session;
    this.persistence = persistence;

    this.view = new Container();
    this.world = new WorldState({ worldId });
    this.camera = new WorldCamera();

    this.region = STARTER_REGION;

    this.ocean =
      new OceanRenderer({
        renderer: this.renderer
      });

    this.shipNavigation =
      new ShipNavigationSystem({
        region: this.region,
        boundaryPadding: 56
      });

    this.playerShip =
      createStarterShip({
        x: 0,
        y: 0
      });

    this.shipRenderer =
      new ShipRenderer();

    this.shipWakeRenderer =
      new ShipWakeRenderer({
        shipHeight: 116
      });

    this.treasureCollection =
      new TreasureCollectionSystem();

    this.treasureRenderer =
      new TreasureRenderer();

    this.mathChallenge =
      new MathChallengeModal();

    this.pendingTreasureId = null;
    this.challengeBusy = false;

    const profile =
      this.session?.playerProfile;

    if (!profile) {
      throw new Error(
        'WorldScene requires an active player profile.'
      );
    }

    this.treasureSpawn =
      new TreasureSpawnSystem({
        worldId,
        region: this.region,
        profile,
        persist: async () => {
          await this.persistence?.savePlayerProfile?.(
            profile
          );
        }
      });

    this.previousPose = {
      x: 0,
      y: 0,
      rotation: 0
    };

    this.currentPose = {
      x: 0,
      y: 0,
      rotation: 0
    };

    this.previousCamera = {
      x: 0,
      y: 0
    };

    this.currentCamera = {
      x: 0,
      y: 0
    };

    this.world.entities.add(this.playerShip);

    this.view.addChild(this.ocean.view);
    this.camera.view.addChild(
      this.treasureRenderer.view
    );
    this.camera.view.addChild(
      this.shipRenderer.view
    );
    this.view.addChild(this.camera.view);
  }

  get profile() {
    return this.session.playerProfile;
  }

  treasureEntities() {
    return this.world.entities
      .all()
      .filter(
        (entity) =>
          entity.type === 'treasure'
      );
  }

  async enter() {
    await Promise.all([
      this.ocean.init(this.assets),
      this.shipRenderer.init(this.assets),
      this.treasureRenderer.init(this.assets)
    ]);

    await this.treasureSpawn.initialize(
      this.world
    );

    this.treasureRenderer.sync(
      this.treasureEntities()
    );

    this.resize();

    const transform =
      this.playerShip.get('transform');

    this.previousPose = {
      ...transform
    };

    this.currentPose = {
      ...transform
    };

    this.previousCamera = {
      x: transform.x,
      y: transform.y
    };

    this.currentCamera = {
      x: transform.x,
      y: transform.y
    };

    this.camera.setPosition(
      transform.x,
      transform.y
    );

    this.ocean.setCameraPosition(
      transform.x,
      transform.y
    );

    this.ocean.setZoom(
      this.camera.zoom
    );

    this.shipRenderer.render(
      transform,
      this.playerShip.get('visual')
    );
  }

  selectTreasure(treasureEntity) {
    if (
      !treasureEntity ||
      this.challengeBusy ||
      this.mathChallenge.opened
    ) {
      return;
    }

    const transform =
      treasureEntity.get('transform');

    if (!transform) return;

    this.pendingTreasureId =
      treasureEntity.id;

    this.shipNavigation.setTarget(
      transform.x,
      transform.y
    );
  }

  async beginTreasureChallenge(
    treasureEntity
  ) {
    if (
      this.challengeBusy ||
      !treasureEntity
    ) {
      return;
    }

    const treasure =
      treasureEntity.get('treasure');

    if (!treasure) return;

    this.challengeBusy = true;
    this.shipNavigation.clearTarget();

    const challenge =
      createMathChallenge(
        treasure.claimToken
      );

    const correct =
      await this.mathChallenge.open(
        challenge
      );

    this.pendingTreasureId = null;

    if (!correct) {
      this.challengeBusy = false;
      return;
    }

    const current =
      this.world.entities.get(
        treasureEntity.id
      );

    // Se um snapshot online trocou/removou esse spawn
    // enquanto a popup estava aberta, não há grant.
    if (
      !current ||
      current.get('treasure')?.claimToken !==
        treasure.claimToken
    ) {
      this.challengeBusy = false;
      return;
    }

    const claimed =
      this.profile.progress.claimedRewards;

    if (
      claimed.includes(
        treasure.claimToken
      )
    ) {
      await this.treasureSpawn.consume(
        this.world,
        current
      );

      this.challengeBusy = false;
      return;
    }

    const grants =
      resolveReward(
        treasure.rewardRef,
        treasure.claimToken
      );

    const applied =
      grantReward(
        this.profile,
        grants
      );

    // Claim é persistido antes do despawn.
    // Assim reconexão/reload não concede duas vezes.
    claimed.push(
      treasure.claimToken
    );

    await this.persistence
      ?.savePlayerProfile?.(
        this.profile
      );

    await this.treasureSpawn.consume(
      this.world,
      current
    );

    this.world.events.emit(
      'treasure:collected',
      {
        treasureId:
          current.id,
        claimToken:
          treasure.claimToken,
        rewardRef:
          treasure.rewardRef,
        grants:
          applied
      }
    );

    this.challengeBusy = false;
  }

  update(dt) {
    this.world.advance(dt);
    this.resize();

    this.treasureSpawn
      .update(this.world)
      .catch((error) => {
        console.error(
          '[TreasureSpawn]',
          error
        );
      });

    const pointerPress =
      this.input
        ?.consumePointerPress?.();

    if (
      pointerPress &&
      !this.mathChallenge.opened
    ) {
      const target =
        this.camera.screenToWorld(
          pointerPress.x,
          pointerPress.y
        );

      const clickedTreasure =
        this.treasureCollection
          .findClickedTreasure(
            this.world,
            target
          );

      if (clickedTreasure) {
        this.selectTreasure(
          clickedTreasure
        );
      } else {
        this.pendingTreasureId = null;

        this.shipNavigation.setTarget(
          target.x,
          target.y
        );
      }
    }

    if (
      this.input?.analog?.active
    ) {
      this.pendingTreasureId = null;
    }

    const before =
      this.playerShip.get('transform');

    this.previousPose = {
      x: before.x,
      y: before.y,
      rotation: before.rotation
    };

    const sharedBoundaryPadding =
      cameraBoundaryPadding(
        this.renderer,
        this.camera
      );

    this.shipNavigation
      .boundaryPadding =
        sharedBoundaryPadding;

    this.shipNavigation.update(
      this.playerShip,
      dt,
      this.input?.analog
    );

    const after =
      this.playerShip.get('transform');

    this.currentPose = {
      x: after.x,
      y: after.y,
      rotation: after.rotation
    };

    if (
      this.pendingTreasureId &&
      !this.challengeBusy
    ) {
      const treasureEntity =
        this.world.entities.get(
          this.pendingTreasureId
        );

      if (!treasureEntity) {
        this.pendingTreasureId = null;
      } else if (
        this.treasureCollection
          .isCollectorInRange(
            this.playerShip,
            treasureEntity
          )
      ) {
        this.beginTreasureChallenge(
          treasureEntity
        ).catch((error) => {
          this.challengeBusy = false;
          console.error(
            '[TreasureChallenge]',
            error
          );
        });
      }
    }

    this.previousCamera = {
      ...this.currentCamera
    };

    const follow =
      1 -
      Math.exp(
        -CAMERA_FOLLOW_SHARPNESS *
          dt
      );

    const desiredCamera = {
      x:
        this.currentCamera.x +
        (
          after.x -
          this.currentCamera.x
        ) *
          follow,
      y:
        this.currentCamera.y +
        (
          after.y -
          this.currentCamera.y
        ) *
          follow
    };

    const clampedCamera =
      clampPointToRegion(
        desiredCamera.x,
        desiredCamera.y,
        this.region,
        sharedBoundaryPadding
      );

    this.currentCamera =
      clampedCamera;

    this.shipWakeRenderer.update(
      after,
      this.playerShip.get('movement'),
      dt
    );

    this.treasureRenderer.sync(
      this.treasureEntities()
    );

    this.treasureRenderer.update(
      dt
    );

    this.shipRenderer.advance(dt);
    this.ocean.update(dt);
  }

  render(alpha = 1) {
    const pose = {
      x:
        this.previousPose.x +
        (
          this.currentPose.x -
          this.previousPose.x
        ) *
          alpha,
      y:
        this.previousPose.y +
        (
          this.currentPose.y -
          this.previousPose.y
        ) *
          alpha,
      rotation:
        lerpAngle(
          this.previousPose.rotation,
          this.currentPose.rotation,
          alpha
        )
    };

    this.shipRenderer.render(
      pose,
      this.playerShip.get('visual')
    );

    const cameraPose = {
      x:
        this.previousCamera.x +
        (
          this.currentCamera.x -
          this.previousCamera.x
        ) *
          alpha,
      y:
        this.previousCamera.y +
        (
          this.currentCamera.y -
          this.previousCamera.y
        ) *
          alpha
    };

    this.ocean.setWake({
      active: true,
      samples:
        this.shipWakeRenderer.samples,
      width: 74,
      opacity: 0.78,
      lifetime: 2588
    });

    this.camera.setPosition(
      cameraPose.x,
      cameraPose.y
    );

    this.ocean.setCameraPosition(
      cameraPose.x,
      cameraPose.y
    );

    this.ocean.setZoom(
      this.camera.zoom
    );

    this.ocean.update(0);
  }

  // Chamado pelo transporte online quando chega
  // o snapshot autoritativo de tesouros.
  async applyOnlineTreasureSnapshot(
    snapshot
  ) {
    this.session.mode = 'online';
    this.pendingTreasureId = null;

    await this.treasureSpawn
      .applyAuthoritativeSnapshot(
        this.world,
        snapshot
      );

    this.treasureRenderer.sync(
      this.treasureEntities()
    );
  }

  async switchTreasureOffline() {
    this.session.mode = 'offline';
    this.pendingTreasureId = null;

    await this.treasureSpawn
      .switchOffline(
        this.world
      );

    this.treasureRenderer.sync(
      this.treasureEntities()
    );
  }

  resize() {
    const {
      width,
      height
    } = this.renderer.screen;

    this.camera.resize(
      width,
      height
    );

    this.ocean.resize(
      width,
      height
    );
  }

  async exit() {
    this.mathChallenge.destroy();
    this.treasureRenderer.destroy();
    this.ocean.destroy?.();
  }
}
