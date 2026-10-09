<template>
  <b2-widget>
    <el-carousel ref="carouselDom" :height="carousel.carouselHeight" :type="carousel.carouselStyle"
      :direction="carousel.carouselDirection" :indicator-position="carousel.carouseIndicator"
      :arrow="carousel.getOption<string>('carousel-arrow-type')" trigger="click"
      :autoplay="false" :interval="carousel.carouselAnimation.duration"
      :loop="carousel.carouselAnimation.loop" @change="carouselChangeFn">
      <el-carousel-item v-for="(imageUrl, index) in carousel.imageList" :key="index" :style="{backgroundImage: `url('${imageUrl}')`, ...carouselItemStyle, ...style2}">
      </el-carousel-item>
    </el-carousel>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { watch, ref, computed, onUnmounted, onMounted } from "vue";
import gsap from "gsap";
import { Carousel } from "./carousel";

let animationDisplayTween = null;
const carousel = useWidget<Carousel>();
const carouselDom = ref(null);

let animationFn = null;

const carouselChangeFn = (currentIndex) => {
  carousel.showIndex.value = currentIndex;
}

watch(() => carousel.imageList.length, (val, oldVal)=> {
  if(val !== oldVal) {
    if(val === 0) {
      carousel.status.error.style = [{ key: undefined, type: "image-empty" }];
    } else {
      carousel.status.error.style = [];
    }
  }
}, {immediate: true})

watch(() => carousel.getOption("carousel-index"), (value) => {
  if(value == -1) return;
  if(value == "prev"){
    carouselDom.value?.prev();
  } else if(value == "next"){
    carouselDom.value?.next();
  } else {
    carouselDom.value?.setActiveItem(value);
  }
  carousel.setActiveItem(-1);
})

const carouselButtonStyle = computed(() => {

  let borderRadius = carousel.getOption<number>("carousel-indicator-border-radius");
  let buttonSize = carousel.getOption<number[]>("carousel-indicator-size") || [0,0];
  let backgroundImagePre = `url(${carousel.imageArrow?.imageArrowPreSrc})`;
  let backgroundImageNext = `url(${carousel.imageArrow?.imageArrowNextSrc})`;
  return {
    buttonWidth: buttonSize[0] + "px",
    buttonHeight: buttonSize[1] + "px",
    borderRadius: borderRadius + "px",
    buttonColor: new Color(carousel.getOption<number[]>("carousel-indicator-color")).toCssString(),
    backgroundImagePre,
    backgroundImageNext
  }
});

const carouselItemStyle = computed(() => {
  let fillStyle = carousel.getOption("fill-style");
  let style = {};
  if(fillStyle == "stretch"){
    style = {
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      backgroundPosition: "center !important",
    }
  } else if(fillStyle == "center") {
    style = {
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center"
    }
  } else {
    style = {
      backgroundRepeat: "repeat",
    }
  }

  return style as any;
});

const carouseSideStyle = computed(()=>{
  let opacity = carousel.getOption<number>("carousel-side-opacity");
  return {
    sideImgOpacity:opacity/100
  };
})

const style2 = computed(() => {
  let fillStyle = carousel.getOption("fill-style");
  let style = {};
  if(fillStyle == "stretch"){
    style = {
      backgroundPosition: "center !important",
    }
  } else if(fillStyle == "center") {
    style = {
      backgroundPosition: "center"
    }
  } else {
  }
  if(carousel.getOption("animation-type") === "overturn" && carousel.getOption("carousel-style") !== "card") {
    style["transition"] = "unset";
  }

  return style as any;
});

onMounted(() => {
  watch(() => {
    return {
      on: carousel.getOption<boolean>("carousel-display"),
      type: carousel.getOption<string>("animation-type"),
      loop: carousel.getOption<boolean>("carousel-loop"),
      duration: carousel.getOption<number>("carousel-duration"),
      style: carousel.getOption("carousel-style"),
      visible: carousel.status.isVisible
    }
  }, (options) => {
    animationDisplayTween?.kill?.();
    animationDisplayTween = null;
    clearTimeout(animationFn);
    if (!options.on || !options.visible) return;

    let changeToNext = () => {
      animationFn = setTimeout(() => {
        if(carousel.status.isHover) return changeToNext();
        if (options.style === "card" || options.type === "translate") {
          carouselDom.value?.next();
          changeToNext();
        } else {
          let itemEls = carousel.dom.getElementsByClassName("el-carousel__item");
          let currentDom = itemEls[carousel.showIndex.value] as HTMLElement;
          animationDisplayTween = gsap.to(currentDom, {
            // "background-size": "0% 100%",
            transform: 'scaleX(0.01)',
            duration: 0.2,
            onComplete: function () {
              let nextDom = null;
              if (itemEls[carousel.showIndex.value + 1]) {
                nextDom = itemEls[carousel.showIndex.value + 1];
                carousel.showIndex.value += 1;
                currentDom.style.transform = `translateX(${-carousel.contentSize.width}px) scale(1)`;
                changeToNext();
              } else if (options.loop) {
                nextDom = itemEls[0];
                carousel.showIndex.value = 0;
                currentDom.style.transform = `translateX(${carousel.contentSize.width * (itemEls.length - 1)}px) scale(1)`;
                changeToNext();
              } else {
                nextDom = itemEls[0];
                carousel.showIndex.value = 0;
                currentDom.style.transform = `translateX(${carousel.contentSize.width * (itemEls.length - 1)}px) scale(1)`;
                clearTimeout(animationDisplayTween);
              }
              carouselDom.value.setActiveItem(carousel.showIndex.value);
              if (nextDom) {
                nextDom.style.opacity = 0; //  防止闪烁
                return gsap.fromTo(nextDom, { transform: 'scaleX(0.01)' }, {
                  transform: 'scaleX(1)',
                  opacity: 1,
                  duration: 0.2,
                });
              }
            }
          })
        }
      }, options.duration * 1000)
    }

    changeToNext();

  }, { immediate: true })
})

onUnmounted(() => {
  animationDisplayTween?.kill?.();
  animationDisplayTween = null;
  clearTimeout(animationFn);
})

</script>

<style lang="scss" scoped>
:deep(.el-carousel) {
  --el-carousel-indicator-width: v-bind("carouselButtonStyle.buttonWidth");
  --el-carousel-indicator-height: v-bind("carouselButtonStyle.buttonHeight");
  .el-carousel__button{
    border-radius: v-bind("carouselButtonStyle.borderRadius");
    background-color: v-bind("carouselButtonStyle.buttonColor");
  }
  .el-carousel__container{
    .el-carousel__arrow--left{
      font-size: 20px;
      background-image: v-bind("carouselButtonStyle.backgroundImagePre");
      background-repeat:no-repeat;
      background-size: 100% 100%;
    }
    .el-carousel__arrow--right{
      font-size: 20px;
      background-image: v-bind("carouselButtonStyle.backgroundImageNext");
      background-repeat:no-repeat;
      background-size: 100% 100%;
    }
  }
  .is-in-stage{
    opacity: v-bind("carouseSideStyle.sideImgOpacity");
  }

  .is-active{
    opacity: 1;
  }

}
</style>
